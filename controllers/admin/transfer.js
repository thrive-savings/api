module.exports = (
  Bluebird,
  Sequelize,
  User,
  Connection,
  Account,
  Transfer,
  config,
  moment,
  amplitude,
  request,
  ConstantsService
) => {
  const {
    STATES,
    TYPES,
    SUBTYPES,
    APPROVAL_STATES,
    REQUEST_METHODS
  } = ConstantsService.TRANSFER

  const MAX_SAVE_AMOUNT = 500000 // $5000

  return {
    create: {
      schema: [
        [
          'data',
          true,
          [
            ['userID', true, 'integer'],
            ['amount', true, 'integer'],
            ['type', true],
            ['subtype', true],
            ['requestMethod'],
            ['extra', 'object']
          ]
        ]
      ],
      async method (ctx) {
        const {
          data: {
            userID,
            amount,
            type,
            subtype,
            requestMethod = REQUEST_METHODS.AUTOMATED,
            extra
          }
        } = ctx.request.body

        const reply = {}
        try {
          if (!Object.values(TYPES).includes(type)) {
            reply.error = true
            reply.errorCode = 'invalid_type'
          } else if (!Object.values(SUBTYPES).includes(subtype)) {
            reply.error = true
            reply.errorCode = 'invalid_subtype'
          } else if (!Object.values(REQUEST_METHODS).includes(requestMethod)) {
            reply.error = true
            reply.errorCode = 'invalid_request_method'
          } else {
            const user = await User.findOne({ where: { id: userID } })
            if (!user) {
              reply.error = true
              reply.errorCode = 'user_not_found'
            } else {
              if (type === TYPES.CREDIT) {
                const withdrawsInProgress = await Transfer.sumCustom(userID, {
                  subtype: SUBTYPES.WITHDRAW,
                  state: STATES.PROCESSING
                })
                if (amount > user.balance - withdrawsInProgress) {
                  reply.error = true
                  reply.errorCode = 'invalid_withdraw'

                  user.sendMessage(
                    user.formInvalidWithdrawalMessage(
                      amount,
                      withdrawsInProgress
                    )
                  )
                }
              }

              if (!reply.error) {
                const instantSettle = ![
                  SUBTYPES.WITHDRAW,
                  SUBTYPES.SAVE
                ].includes(subtype)
                const adminApprovalNeeded =
                  subtype === SUBTYPES.SAVE &&
                  (['vip', 'tester'].includes(user.userType) ||
                    amount > MAX_SAVE_AMOUNT)

                const transfer = await Transfer.create({
                  amount,
                  type,
                  subtype,
                  requestMethod,
                  state: instantSettle
                    ? STATES.COMPLETED
                    : adminApprovalNeeded
                      ? STATES.WAITING
                      : STATES.QUEUED,
                  approvalState: adminApprovalNeeded
                    ? APPROVAL_STATES.ADMIN_REQUESTED
                    : APPROVAL_STATES.NOT_NEEDED,
                  extra,
                  userID: user.id
                })

                const timeline = transfer.timeline
                if (instantSettle) {
                  reply.instantSettle = instantSettle
                  const timelineEntry = {
                    note: 'Settled instantly',
                    date: moment(),
                    state: STATES.COMPLETED
                  }
                  timeline.push(timelineEntry)
                  transfer.timeline = timeline
                  await transfer.save()

                  user.updateBalance(amount, type)
                  user.notifyAboutTransfer(amount, subtype)
                } else if (adminApprovalNeeded) {
                  reply.adminApprovalNeeded = adminApprovalNeeded
                  request.post({
                    uri: `${
                      config.constants.URL
                    }/slack-request-transfer-approval`,
                    body: {
                      data: {
                        transferID: transfer.id
                      }
                    },
                    json: true
                  })

                  const timelineEntry = {
                    note: 'Requested admin approval',
                    date: moment(),
                    state: STATES.WAITING
                  }
                  timeline.push(timelineEntry)

                  transfer.timeline = timeline
                  transfer.state = timelineEntry.state
                  await transfer.save()
                }

                if (transfer.state === STATES.QUEUED) {
                  request.post({
                    uri: `${config.constants.URL}/admin/transfer-process`,
                    body: {
                      secret: process.env.apiSecret,
                      data: {
                        transferID: transfer.id
                      }
                    },
                    json: true
                  })
                }

                reply.data = transfer.getData()
              }
            }
          }
        } catch (e) {
          reply.error = true
          reply.errorCode = 'try_catched'
          reply.errorData = e
        }

        amplitude.track({
          eventType: `TRANSFER_CREATE_${
            reply.error
              ? 'FAIL'
              : reply.adminApprovalNeeded
                ? 'ADMIN_APPROVAL_REQUESTED'
                : 'SUCCEED'
          }`,
          userId: userID,
          eventProperties: reply
        })
        request.post({
          uri: process.env.slackWebhookURL,
          body: {
            text: `${
              reply.instantSettle ? 'Transfer Instant: ' : 'Transfer Creation: '
            } *${reply.error ? `FAIL | ${reply.errorCode}` : 'SUCCEED'}* ${
              reply.data
                ? `| *${reply.data.subtype}* | Transfer ID ${reply.data.id} `
                : ''
            } | User ID ${userID}`
          },
          json: true
        })

        ctx.body = reply
      }
    },

    updateAmount: {
      schema: [
        [
          'data',
          true,
          [
            ['transferID', true, 'integer'],
            ['amount', true, 'integer'],
            ['origianlMesageURI']
          ]
        ]
      ],
      async method (ctx) {
        const {
          data: { transferID, amount, origianlMesageURI }
        } = ctx.request.body

        const reply = { transferID }
        try {
          const transfer = await Transfer.findOne({
            include: [User],
            where: { id: transferID }
          })

          if (transfer) {
            const timeline = transfer.timeline
            const timelineEntry = {
              note: 'Admin updated transfer amount',
              date: moment(),
              state: STATES.WAITING,
              prevAmount: transfer.amount,
              newAmount: amount
            }
            timeline.push(timelineEntry)

            transfer.timeline = timeline
            transfer.amount = amount
            transfer.state = timelineEntry.state
            transfer.approvalState = APPROVAL_STATES.ADMIN_REQUESTED
            await transfer.save()

            request.post({
              uri: `${config.constants.URL}/slack-request-transfer-approval`,
              body: {
                data: {
                  transferID: transfer.id,
                  uri: origianlMesageURI
                }
              },
              json: true
            })
          } else {
            reply.error = true
            reply.errorCode = 'transfer_not_found'
          }
        } catch (e) {
          reply.error = true
          reply.errorCode = 'try_catched'
          reply.errorData = e
          reply.errorMessage = e.message
        }

        amplitude.track({
          eventType: `TRANSFER_UPDATE_AMOUNT_${
            reply.error ? 'FAIL' : 'SUCCEED'
          }`,
          userId: reply.userID ? reply.userID : 'server',
          eventProperties: reply
        })
        request.post({
          uri: process.env.slackWebhookURL,
          body: {
            text: `Transfer Amount Update: *${
              reply.error
                ? `FAIL - ${reply.errorCode}${
                  reply.errorMessage ? ` - ${reply.errorMessage}` : ''
                }`
                : `SUCCEED${reply.sentToProvider ? ' - Sent to Provider' : ''}`
            }* | Transfer ${transferID}${
              reply.userID ? ` | User ${reply.userID}` : ''
            }`
          },
          json: true
        })

        ctx.body = reply
      }
    },

    // Processing Endpoints

    processBatch: {
      async method (ctx) {
        const reply = {}

        try {
          const queuedTransfers = await Transfer.findAll({
            where: {
              state: STATES.QUEUED
            }
          })

          amplitude.track({
            eventType: 'TRANSFER_PROCESS_BATCH_PASS',
            userId: 'server',
            eventProperties: {
              transferCount: queuedTransfers ? queuedTransfers.length : 0
            }
          })

          if (queuedTransfers && queuedTransfers.length) {
            Bluebird.all(
              queuedTransfers.map(transfer =>
                request.post({
                  uri: `${config.constants.URL}/admin/transfer-process`,
                  body: {
                    secret: process.env.apiSecret,
                    data: { transferID: transfer.id }
                  },
                  json: true
                })
              )
            )
          }
        } catch (e) {
          reply.error = true
          reply.errorCode = 'try_catched'
          reply.errorData = e
        }

        if (reply.error) {
          amplitude.track({
            eventType: 'TRANSFER_PROCESS_BATCH_FAIL',
            userId: 'server',
            eventProperties: reply
          })
        }

        ctx.body = reply
      }
    },

    process: {
      schema: [['data', true, [['transferID', true, 'integer']]]],
      async method (ctx) {
        const {
          data: { transferID }
        } = ctx.request.body

        const reply = { transferID }
        try {
          const transfer = await Transfer.findOne({
            include: [User],
            where: { id: transferID }
          })

          if (transfer) {
            if (transfer.state === STATES.QUEUED) {
              const {
                user,
                amount,
                type,
                uuid,
                timeline,
                extra: {
                  memo,
                  countryCode,
                  accountID,
                  fromNodeID,
                  toNodeID
                } = {}
              } = transfer

              reply.userID = user.id
              reply.countryCode = countryCode

              if (countryCode === 'CAN') {
                const account = await Account.findOne({
                  where: { id: accountID }
                })
                if (account) {
                  const body = {
                    amount_in_cents: amount,
                    transaction_type: `direct_${type}`,
                    unique_reference: uuid,
                    email: user.email,
                    first_name: user.firstName,
                    last_name: user.lastName,
                    fund_token: process.env.versaPayFundToken
                  }
                  if (memo) {
                    body.memo = memo
                  }

                  if (account.versapay_token) {
                    if (type === 'debit') {
                      body.from_fund_token = account.versapay_token
                    } else {
                      body.to_fund_token = account.versapay_token
                    }
                  } else {
                    body.institution_number = account.institution
                    body.branch_number = account.transit
                    body.account_number = account.number
                  }

                  try {
                    await request.post({
                      uri: `${process.env.versaPayApiURL}/api/transactions`,
                      auth: {
                        user: process.env.versaPayToken,
                        pass: process.env.versaPayKey
                      },
                      body,
                      json: true
                    })
                    reply.sentToProvider = true
                  } catch (versapayError) {
                    reply.error = true
                    reply.errorCode = 'try_catched_versapay_error'
                    reply.errorData = versapayError
                    reply.errorMessage = versapayError.message

                    const timelineEntry = {
                      note: 'Failed with immediate provider error',
                      date: moment(),
                      state: STATES.FAILED,
                      errorMessage: reply.errorMessage
                    }
                    timeline.push(timelineEntry)

                    transfer.timeline = timeline
                    transfer.state = timelineEntry.state
                    await transfer.save()
                  }
                } else {
                  reply.error = true
                  reply.errorCode = 'no_account_set'
                }
              } else if (countryCode === 'USA') {
                console.log({ fromNodeID, toNodeID })
                // TODO: create ACH transaction @ Synapse
              } else {
                reply.error = true
                reply.errorCode = 'no_country_code_provided'
              }

              if (reply.sentToProvider) {
                user.setNextSaveDate()

                const timelineEntry = {
                  note: 'Sent to be processed by the provider',
                  date: moment(),
                  state: STATES.SENT
                }
                timeline.push(timelineEntry)

                transfer.timeline = timeline
                transfer.state = timelineEntry.state
                await transfer.save()
              }
            } else {
              reply.error = true
              reply.errorCode = 'transfer_not_queued'
            }
          } else {
            reply.error = true
            reply.errorCode = 'transfer_not_found'
          }
        } catch (e) {
          reply.error = true
          reply.errorCode = 'try_catched'
          reply.errorData = e
          reply.errorMessage = e.message
        }

        amplitude.track({
          eventType: `TRANSFER_PROCESS_${reply.error ? 'FAIL' : 'SUCCEED'}`,
          userId: reply.userID ? reply.userID : 'server',
          eventProperties: reply
        })
        request.post({
          uri: process.env.slackWebhookURL,
          body: {
            text: `Transfer Processing: *${
              reply.error
                ? `FAIL - ${reply.errorCode}${
                  reply.errorMessage ? ` - ${reply.errorMessage}` : ''
                }`
                : `SUCCEED${reply.sentToProvider ? ' - Sent to Provider' : ''}`
            }* | Transfer ${transferID}${
              reply.userID ? ` | User ${reply.userID}` : ''
            }`
          },
          json: true
        })

        ctx.body = reply
      }
    },

    // Internal Management Endpoints
    display: {
      schema: [['data', true, [['transferID'], ['filter', 'object']]]],
      async method (ctx) {
        const {
          data: { transferID, filter }
        } = ctx.request.body

        const reply = {}
        try {
          const where = {}

          if (transferID) {
            where.id = transferID
          } else if (filter) {
            const {
              userIDs,
              state,
              subtype,
              requestMethod,
              approvalState
            } = filter

            if (userIDs) {
              where.userID = { [Sequelize.Op.in]: userIDs.split(',') }
            }
            if (state) {
              where.state = state
            }
            if (subtype) {
              where.subtype = subtype
            }
            if (requestMethod) {
              where.requestMethod = requestMethod
            }
            if (approvalState) {
              where.approvalState = approvalState
            }
          }

          const transfers = await Transfer.findAll({
            where,
            order: [['createdAt']]
          })
          if (transfers && transfers.length) {
            const tab = '   '
            reply.message = `${transfers.length} transfers found:\n`
            for (const {
              id,
              userID,
              state,
              stateRaw,
              subtype,
              requestMethod,
              extra
            } of transfers) {
              reply.message += ` - *Transfer ID ${id} | User ID ${userID}*\n`
              reply.message += `${tab} - State: *${state}*\n${
                stateRaw ? `${tab} - State Raw: *${stateRaw}*\n` : ''
              }${tab} - Subtype: *${subtype}*\n${tab} - Request Method: *${requestMethod}*\n`
              reply.message += `${tab} - Extra: ${JSON.stringify(extra)}\n`
            }
          } else {
            reply.error = true
            reply.errorCode = 'no_transfer_found'
            reply.message = 'No transfers found for provided filter options'
          }
        } catch (e) {
          reply.error = true
          reply.errorCode = 'try_catched'
          reply.errorData = e
          reply.message = 'Request catched an error'
        }

        ctx.body = reply
      }
    },

    createManual: {
      schema: [
        [
          'data',
          true,
          [
            ['userID', true, 'integer'],
            ['accountID', 'integer'],
            ['subtype', true],
            ['amount', true, 'integer']
          ]
        ]
      ],
      async method (ctx) {
        const {
          data: { userID, accountID: requestedAccountID, subtype, amount }
        } = ctx.request.body

        const reply = { userID, subtype, amount }
        try {
          let user
          let connection
          let account
          if (requestedAccountID) {
            account = await Account.findOne({
              include: [Connection],
              where: { id: requestedAccountID }
            })
            if (!account) {
              reply.error = true
              reply.errorCode = 'requested_account_not_found'
              reply.message = `No account found for ID ${requestedAccountID}`
            } else {
              user = await User.findOne({ where: { id: userID } })
              connection = account.connection
            }
          } else {
            user = await User.findOne({
              include: [{ model: Connection, include: [Account] }],
              where: { id: userID }
            })

            const {
              error: connectionError,
              connection: primaryConnection,
              account: primaryAccount
            } = user.getPrimaryAccount()

            if (connectionError) {
              reply.error = true
              reply.errorCode = connectionError
              reply.message = `Error *${connectionError}* occured while fetching primary user account`
            } else {
              connection = primaryConnection
              account = primaryAccount
            }
          }

          if (!reply.error && !user) {
            reply.error = true
            reply.errorCode = 'user_not_found'
            reply.message = `User not found for ID ${userID}`
          }

          if (user && connection && account) {
            // TODO: implement the logic
            await request.post({
              uri: `${config.constants.URL}/admin/transfer-create`,
              body: {
                secret: process.env.apiSecret,
                data: {
                  userID,
                  amount,
                  type:
                    subtype === SUBTYPES.WITHDRAW ? TYPES.CREDIT : TYPES.DEBIT,
                  subtype,
                  requestMethod: REQUEST_METHODS.MANUAL,
                  extra: {
                    memo: `Thrive Savings ${
                      subtype === SUBTYPES.WITHDRAW ? 'Withdraw' : 'Save'
                    }`,
                    countryCode: connection.countryCode,
                    accountID: account.id
                  }
                }
              },
              json: true
            })
          }
        } catch (e) {
          reply.error = true
          reply.errorCode = 'try_catched'
          reply.errorData = e
          reply.message = 'Request catched an error'
        }

        ctx.body = reply
      }
    }
  }
}
