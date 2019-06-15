module.exports = (
  Bluebird,
  User,
  Account,
  Transfer,
  config,
  moment,
  amplitude,
  request
) => {
  const {
    URL,
    TRANSFER_ENUMS: {
      STATES,
      TYPES,
      SUBTYPES,
      APPROVAL_STATES,
      REQUEST_METHODS
    }
  } = config.constants

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
              if (type === TYPES.CREDIT && amount > user.balance) {
                reply.error = true
                reply.errorCode = 'invalid_withdraw'
                user.notifyAboutTransfer(amount, reply.errorCode)
              } else {
                const instantSettle = ![
                  SUBTYPES.WITHDRAW,
                  SUBTYPES.SAVE
                ].includes(subtype)
                const adminApprovalNeeded =
                  subtype === SUBTYPES.SAVE &&
                  (user.userType === 'vip' || amount > MAX_SAVE_AMOUNT)

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
                  processed: instantSettle,
                  processedDate: instantSettle ? moment() : null,
                  approvalState: adminApprovalNeeded
                    ? APPROVAL_STATES.ADMIN_REQUESTED
                    : APPROVAL_STATES.NOT_NEEDED,
                  extra,
                  userID: user.id
                })

                if (instantSettle) {
                  user.updateBalance(amount, type)
                  user.notifyAboutTransfer(amount, subtype)
                }
                if (adminApprovalNeeded) {
                  reply.adminApprovalNeeded = adminApprovalNeeded
                  request.post({
                    uri: `${URL}/slack-request-transfer-approval`,
                    body: {
                      data: {
                        transferID: transfer.id
                      }
                    },
                    json: true
                  })

                  const timeline = transfer.timeline
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
                    uri: `${URL}/admin/transfer-process`,
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
          eventType: `TRANSFER_INITIATE_${
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
            text: `Transfer Creation Attempt: *${
              reply.error ? `FAIL | ${reply.errorCode}` : 'SUCCEED'
            }* ${
              reply.data ? `| Transfer ${reply.data.id} ` : ''
            } | User ${userID}`
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
              uri: `${URL}/slack-request-transfer-approval`,
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
            text: `Transfer Processing Attempt: *${
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
    }
  }
}
