module.exports = (
  Sequelize,
  User,
  Connection,
  Account,
  Queue,
  Transfer,
  Bonus,
  Goal,
  Bluebird,
  request,
  config,
  moment
) => {
  const {
    URL,
    TRANSFER: { STATES, TYPES, SUBTYPES, APPROVAL_STATES, REQUEST_METHODS }
  } = config.constants

  return {
    notifyAboutSchedulerRun: {
      schema: [['data', true, [['job', true]]]],
      async method (ctx) {
        const {
          data: { job }
        } = ctx.request.body

        await request.post({
          uri: process.env.slackWebhookURL,
          body: { text: `Scheduler ran for job: *${job}*` },
          json: true
        })

        ctx.body = {}
      }
    },

    echoOkr: {
      async method (ctx) {
        const usersCount = await User.count()
        request.post({
          uri: process.env.slackWebhookURL,
          body: {
            text: `*OKR Update*: *${usersCount} users* in the system currently.`
          },
          json: true
        })
        ctx.body = {}
      }
    },

    deactivateCanadians: {
      async method (ctx) {
        const reply = {}

        try {
          const connections = await Connection.findAll({
            where: { countryCode: 'CAN' }
          })
          if (connections && connections.length) {
            reply.count = connections.length
            reply.connections = []

            for (const connection of connections) {
              const data = {
                id: connection.id,
                userID: connection.userID,
                countryCode: connection.countryCode,
                institutionName: connection.institutionName
              }
              reply.connections.push(data)

              User.update(
                { isActive: false },
                { where: { id: connection.userID } }
              )
            }
          } else {
            reply.error = true
            reply.errorCode = 'no_canadian_connections'
          }
        } catch (e) {
          reply.error = true
          reply.errorCode = 'try_catched'
          reply.errorData = e
        }

        ctx.body = reply
      }
    },

    refundCanadians: {
      schema: [
        [
          'data',
          true,
          [['minUserID', true, 'integer'], ['maxUserID', true, 'integer']]
        ]
      ],
      async method (ctx) {
        ctx.request.socket.setTimeout(5 * 60 * 1000)

        const {
          data: { minUserID, maxUserID }
        } = ctx.request.body

        const reply = {
          total: 0,

          refundable_users_count: 0,
          refundable_users: [],

          non_refundable_users_count: 0,
          non_refundable_users: [],

          users_with_no_banks_count: 0,
          users_with_no_banks: []
        }

        try {
          const users = await User.findAll({
            include: [{ model: Connection, include: [Account] }],
            where: {
              id: {
                [Sequelize.Op.gt]: minUserID,
                [Sequelize.Op.lte]: maxUserID
              }
            }
          })
          if (users && users.length) {
            reply.total = users.length

            for (const user of users) {
              const userReplyData = {
                id: user.id,
                isActive: user.isActive,
                balance: user.balance,
                countryCode: 'CAN',
                connectionsCount: 0
              }

              const connections = user.getConnections()
              if (connections && connections.length) {
                userReplyData.connectionsCount = connections.length
                for (const connection of connections) {
                  if (connection.countryCode === 'USA') {
                    userReplyData.countryCode = 'USA'
                  }
                }
              }

              if (
                userReplyData.countryCode === 'CAN' &&
                userReplyData.connectionsCount &&
                userReplyData.balance
              ) {
                if (user.isActive) {
                  user.isActive = false
                  user.save()
                }

                const { account: primaryAccount } = user.getPrimaryAccount()
                if (primaryAccount) {
                  userReplyData.primaryAccountID = primaryAccount.id
                  /*
                  try {
                    await request.post({
                      uri: `${URL}/admin/transfer-create`,
                      body: {
                        secret: process.env.apiSecret,
                        data: {
                          userID: user.id,
                          amount: user.balance,
                          type: TYPES.CREDIT,
                          subtype: SUBTYPES.WITHDRAW,
                          extra: {
                            memo: 'Full Refund Withdrawal',
                            accountID: primaryAccount.id,
                            countryCode: userReplyData.countryCode
                          }
                        }
                      },
                      json: true
                    })
                  } catch (e) {
                    userReplyData.error = 'ERROR_ON_TRANSFER'
                    userReplyData.errorData = e
                  }
                  */

                  reply.refundable_users.push(userReplyData)
                } else {
                  reply.non_refundable_users.push(userReplyData)
                }
              } else if (
                userReplyData.countryCode === 'CAN' &&
                userReplyData.connectionsCount === 0 &&
                userReplyData.balance
              ) {
                reply.users_with_no_banks.push(userReplyData)
              }
            }

            reply.refundable_users_count = reply.refundable_users.length
            reply.non_refundable_users_count = reply.non_refundable_users.length
            reply.users_with_no_banks_count = reply.users_with_no_banks.length
          }
        } catch (e) {
          console.log(e)
        }

        ctx.body = reply
      }
    },

    printRefundTransfers: {
      async method (ctx) {
        const reply = { count: 0, refunds: [] }

        try {
          const transfers = await Transfer.findAll({
            where: { type: TYPES.CREDIT, subtype: SUBTYPES.WITHDRAW }
          })

          if (transfers && transfers.length) {
            for (const transfer of transfers) {
              const extra = transfer.extra
              if (extra.memo === 'Full Refund Withdrawal') {
                reply.refunds.push(transfer.getData())
              }
            }
            reply.count = reply.refunds.length
          }
        } catch (e) {
          console.log(e)
        }

        ctx.body = reply
      }
    },

    unlink: {
      schema: [['data', true, [['userIds', true, 'array']]]],
      async method (ctx) {
        const {
          data: { userIds }
        } = ctx.request.body

        const users = await User.findAll({
          where: { id: { [Sequelize.Op.in]: userIds } }
        })

        for (const user of users) {
          user.unlink()
        }

        ctx.body = {}
      }
    },

    updateBalance: {
      schema: [
        [
          'data',
          true,
          [
            ['userID', true, 'integer'],
            ['amount', true, 'integer'],
            ['type', true],
            ['subtype']
          ]
        ]
      ],
      async method (ctx) {
        const {
          data: { userID, amount, type, subtype }
        } = ctx.request.body

        const user = await User.findOne({ where: { id: userID } })
        if (!user) {
          return Bluebird.reject([
            { key: 'User', value: `User not found for ID: ${userID}` }
          ])
        }

        const res = await request.post({
          uri: `${URL}/admin/transfer-create`,
          body: {
            secret: process.env.apiSecret,
            data: {
              userID,
              amount,
              type,
              subtype:
                subtype ||
                (type === TYPES.DEBIT ? SUBTYPES.SAVE : SUBTYPES.WITHDRAW),
              requestMethod: REQUEST_METHODS.MANUAL
            }
          },
          json: true
        })

        ctx.body = res
      }
    },

    generateReferralCode: {
      schema: [['data', true, [['userIDs', true, 'array']]]],
      async method (ctx) {
        const {
          data: { userIDs }
        } = ctx.request.body

        const where = { referralCode: null }
        if (userIDs.length > 0) {
          where.id = { [Sequelize.Op.in]: userIDs }
        }

        const users = await User.findAll({ where })
        if (users && users.length > 0) {
          for (const user of users) {
            user.generateReferralCode()
          }
        }

        ctx.body = {}
      }
    },

    promptRating: {
      schema: [['data', true, [['userIDs', true, 'array']]]],
      async method (ctx) {
        const {
          data: { userIDs }
        } = ctx.request.body

        let users
        if (userIDs.length > 0) {
          users = await User.findAll({
            where: { id: { [Sequelize.Op.in]: userIDs } }
          })
        } else {
          users = await User.findAll()
        }

        if (users && users.length > 0) {
          for (const user of users) {
            user.canPromptRating()
          }
        }

        ctx.body = {}
      }
    },

    importTransferData: {
      schema: [['data', true, [['userIDs', true, 'array']]]],
      async method (ctx) {
        const {
          data: { userIDs }
        } = ctx.request.body

        let users
        if (userIDs.length) {
          users = await User.findAll({
            where: { id: { [Sequelize.Op.in]: userIDs } }
          })
        } else {
          users = await User.findAll()
        }

        const date = moment()

        const reply = { users: {} }
        if (users && users.length) {
          for (const user of users) {
            if (!Object.keys(reply).includes(user.id)) {
              reply.users[user.id] = {
                balance: user.balance,
                queueSum: {
                  settled: 0,
                  processing: 0
                },
                transferSum: {
                  settled: 0,
                  processing: 0
                },
                transfers: []
              }

              const queues = await Queue.findAll({
                where: { userID: user.id },
                order: [['id']]
              })

              if (queues && queues.length) {
                for (const {
                  amount,
                  type,
                  state,
                  requestMethod,
                  // createdAt,
                  processedDate,
                  versapay_token: versapayToken,
                  // uuid,
                  accountID,
                  userID
                } of queues) {
                  const queueAmountToAdd =
                    type === 'credit' ? -1 * amount : amount
                  if (state === 'completed') {
                    reply.users[userID].queueSum.settled += queueAmountToAdd
                  } else if (state === 'in_progress') {
                    reply.users[userID].queueSum.processing += queueAmountToAdd
                  }

                  const transferData = {
                    amount,
                    type: type === 'credit' ? TYPES.CREDIT : TYPES.DEBIT,
                    subtype:
                      type === 'credit' ? SUBTYPES.WITHDRAW : SUBTYPES.SAVE,
                    stateRaw: state,
                    platformID: versapayToken,
                    timeline: [
                      {
                        note: 'Imported from old transfer system',
                        date
                      }
                    ],
                    extra: {
                      memo: 'Imported from old transfer system',
                      countryCode: 'CAN',
                      accountID,
                      imported: true,
                      processedDate
                    },
                    userID
                  }

                  if (state) {
                    switch (state) {
                      case 'in_progress':
                        transferData.state = STATES.PROCESSING
                        break
                      case 'completed':
                        transferData.state = STATES.COMPLETED
                        break
                      case 'error':
                      case 'failed':
                        transferData.state = STATES.FAILED
                        break
                      case 'cancelled':
                        transferData.state = STATES.CANCELED
                        break
                      case 'nsfed':
                        transferData.state = STATES.RETURNED
                        break
                    }
                  } else {
                    transferData.state = STATES.CANCELED
                  }
                  transferData.timeline[0].state = transferData.state

                  switch (requestMethod) {
                    case 'Automated':
                      transferData.extra.memo += ' - automated'
                      break
                    case 'ThriveBot':
                      transferData.extra.memo += ' - chatbot trigger'
                      break
                    case 'AutomatedApproved':
                      transferData.extra.memo +=
                        ' - automated & approvd by admin'
                      transferData.approvalState =
                        APPROVAL_STATES.ADMIN_APPROVED
                      break
                    case 'Manual':
                      transferData.extra.memo += ' - manual trigger'
                      transferData.requestMethod = REQUEST_METHODS.MANUAL
                      break
                    case 'ManualDirect':
                      transferData.requestMethod = REQUEST_METHODS.MANUAL
                      transferData.extra.memo +=
                        ' - triggered through direct ACH numbers'
                      break
                    case 'ManualUpdate':
                      transferData.requestMethod = REQUEST_METHODS.MANUAL
                      transferData.extra.memo += ' - manual DB update'
                      break
                    case 'EmployerBonus':
                      transferData.subtype = SUBTYPES.MATCH
                      transferData.extra.memo += ' - employer bonus'
                      break
                    case 'ReferralReward':
                      transferData.subtype = SUBTYPES.REWARD
                      transferData.extra.memo += ' - referral reward'
                      transferData.extra.supplyTable = 'Referral'
                      break
                    case 'MomentumOffer':
                      transferData.subtype = SUBTYPES.MATCH
                      transferData.extra.memo += ' - momentum offer bonus'
                      transferData.extra.supplyTable = 'MomentumOffer'
                      break
                    case 'InAppRequest':
                      transferData.extra.memo += ' - goal withdrawal'
                      break
                    case 'USER_IMPORTED':
                      transferData.extra.memo +=
                        ' - imported from the beta system'
                      break
                  }

                  const amountToAdd =
                    transferData.type === TYPES.CREDIT
                      ? -1 * transferData.amount
                      : transferData.amount

                  if (transferData.state === STATES.COMPLETED) {
                    reply.users[userID].transferSum.settled += amountToAdd
                  } else if (transferData.state === STATES.PROCESSING) {
                    reply.users[userID].transferSum.processing += amountToAdd
                  }

                  // const transfer = await Transfer.create(transferData)
                  // await transfer.update({ uuid, createdAt })
                  // reply.users[userID].transfers.push(transfer.getData())
                }
              }

              const userReplyData = reply.users[user.id]
              if (userReplyData.transferSum.settled !== userReplyData.balance) {
                request.post({
                  uri: process.env.slackWebhookURL,
                  body: {
                    text: `Transfer Data Import - *dismatch detected*: \n - User: ${
                      user.firstName
                    } ${user.lastName} | ID ${user.id}\n - Balance: ${
                      userReplyData.balance
                    }\n - Transfer Processing Sum: ${
                      userReplyData.transferSum.processing
                    }\n - Transfer Settled Sum: ${
                      userReplyData.transferSum.settled
                    }\n - Queue Processing Sum: ${
                      userReplyData.queueSum.processing
                    }\n - Queue Settled Sum: ${userReplyData.queueSum.settled}`
                  },
                  json: true
                })
              }
            }
          }
        }

        ctx.body = reply
      }
    },

    syncHistory: {
      schema: [['data', true, [['userIDs', true, 'array']]]],
      async method (ctx) {
        const {
          data: { userIDs }
        } = ctx.request.body

        let users
        if (userIDs.length > 0) {
          users = await User.findAll({
            where: { id: { [Sequelize.Op.in]: userIDs } }
          })
        } else {
          users = await User.findAll()
        }

        const reply = { users: {} }
        if (users && users.length > 0) {
          for (const user of users) {
            if (!Object.keys(reply).includes(user.id)) {
              reply.users[user.id] = {
                balance: user.balance,
                totalSum: 0,
                queueSum: 0,
                bonusSum: 0,
                transferSum: 0,
                goalProgressSum: 0
              }
            }

            const queues = await Queue.findAll({
              where: {
                userID: user.id,
                state: 'completed',
                type: { [Sequelize.Op.ne]: 'bonus' }
              },
              order: [['id']]
            })
            for (const queue of queues) {
              const amountDelta =
                queue.type === 'credit' ? -1 * queue.amount : queue.amount
              reply.users[user.id].totalSum += amountDelta
              reply.users[user.id].queueSum += amountDelta
            }

            const bonuses = await Bonus.findAll({
              where: { userID: user.id },
              order: [['id']]
            })
            for (const bonus of bonuses) {
              const amountDelta = bonus.amount
              reply.users[user.id].totalSum += amountDelta
              reply.users[user.id].bonusSum += amountDelta
            }

            const transfers = await Transfer.findAll({
              where: { userID: user.id, state: 'completed' },
              order: [['id']]
            })
            for (const transfer of transfers) {
              const amountDelta =
                transfer.type === 'credit'
                  ? -1 * transfer.amount
                  : transfer.amount
              reply.users[user.id].transferSum += amountDelta
            }

            reply.users[user.id].goalProgressSum = await Goal.sum('progress', {
              where: { userID: user.id }
            })
          }

          reply.matches = []
          reply.dismatches = []
          for (const key of Object.keys(reply.users)) {
            const { balance, totalSum } = reply.users[key]
            if (balance === totalSum) {
              reply.matches.push(key)
            } else {
              reply.dismatches.push(key)
            }
          }
        } else {
          return Bluebird.reject([
            { key: 'no_user_found', value: 'No user found' }
          ])
        }

        ctx.body = reply
      }
    },

    sendSms: {
      schema: [
        ['data', true, [['userID', true, 'integer'], ['message', true]]]
      ],
      async method (ctx) {
        const {
          data: { userID, message }
        } = ctx.request.body

        const user = await User.findOne({ where: { id: userID } })

        let replyMessage = `User with ID [${userID}] not found. Try getting correct ID by using /userID command.`
        if (user) {
          user.sendMessage(message, 'Manual')

          replyMessage = `Reply from Thrive to user ${user.id} | ${
            user.phone
          } | ${user.firstName} ${user.lastName} | ${message}`
        }

        ctx.body = replyMessage
      }
    },

    addCompany: {
      schema: [['data', true, [['names', true, 'array']]]],
      async method (ctx) {
        const {
          data: { names }
        } = ctx.request.body

        let replyMessage = 'Company Added '
        for (const companyName of names) {
          if (companyName) {
            const {
              data: { code: companyCode }
            } = await request.post({
              uri: `${URL}/admin/company-add`,
              body: {
                secret: process.env.apiSecret,
                data: { name: companyName.toString().trim() }
              },
              json: true
            })
            replyMessage += `| Name: ${companyName} - Code: ${companyCode} `
          }
        }

        ctx.body = replyMessage
      }
    },

    createDumbAccount: {
      schema: [
        [
          'data',
          true,
          [
            ['userID', true, 'integer'],
            ['countryCode', true],
            ['achNumbers', true, 'object']
          ]
        ]
      ],
      async method (ctx) {
        const {
          data: { userID, countryCode, achNumbers }
        } = ctx.request.body

        let responseMsg = `Creating the Account for User ${userID}`
        try {
          if (['CAN', 'USA'].includes(countryCode)) {
            const user = await User.findOne({ where: { id: userID } })
            if (user) {
              let connection = await Connection.findOne({
                where: { quovoConnectionID: 0, userID }
              })
              if (!connection) {
                connection = await Connection.create({
                  userID,
                  countryCode,
                  institutionName: 'Dumb ACH Institution',
                  status: 'dumb',
                  quovoUserID: user.quovoUserID,
                  quovoConnectionID: 0,
                  quovoInstitutionID: 0
                })
              }

              const accountData = {
                name: 'ManualACHAccount',
                nickname: `${
                  user.firstName
                }'s manual ACH account for ${countryCode}`,
                userID,
                connectionID: connection.id,
                quovoConnectionID: 0,
                quovoAccountID: 0,
                quovoUserID: user.quovoUserID,
                number: achNumbers.account
              }
              if (countryCode === 'CAN') {
                accountData.institution = achNumbers.institution
                accountData.transit = achNumbers.transit
              } else {
                accountData.routing = achNumbers.routing
              }

              const account = await Account.create(accountData)

              responseMsg = `Account ${account.id} | Connection ${
                connection.id
              } is created for User ${userID}`
            } else {
              responseMsg = `User not found for ID ${userID}`
            }
          } else {
            responseMsg = `Wrong Country Code ${countryCode} is provided for User ${userID}`
          }
        } catch (e) {
          responseMsg = `Direct Transfer failed for User ${userID}`
        }

        ctx.body = responseMsg
      }
    },

    bonusUser: {
      schema: [
        [
          'data',
          true,
          [
            ['userID', true, 'integer'],
            ['companyID', true, 'integer'],
            ['amount', true, 'integer']
          ]
        ]
      ],
      async method (ctx) {
        const {
          data: { userID, companyID, amount }
        } = ctx.request.body

        let responseMsg = `Success: bonused User ${userID} | Company ${companyID}`
        try {
          await request.post({
            uri: `${URL}/admin/company-top-up-user`,
            body: {
              secret: process.env.apiSecret,
              data: { companyID, userID, amount }
            },
            json: true
          })
        } catch (e) {
          responseMsg = `Bonusing User failed for User ${userID} | Company ${companyID}`
        }

        ctx.body = responseMsg
      }
    },

    updateUser: {
      schema: [
        [
          'data',
          true,
          [
            ['userID', true, 'integer'],
            ['keyword', true],
            ['submission', true, 'object']
          ]
        ]
      ],
      async method (ctx) {
        const {
          data: { userID, keyword, submission }
        } = ctx.request.body

        let responseMsg = ''

        const KEYWORDS = {
          CONNECTION: 'connection',
          ACCOUNT: 'account',
          ACH: 'ach',
          GENERAL: 'general',
          PREFERENCES: 'preferences'
        }

        try {
          const user = await User.findOne({
            include: [{ model: Connection, include: [Account] }],
            where: { id: userID }
          })
          if (user) {
            switch (keyword) {
              default:
              case KEYWORDS.CONNECTION:
                const { connectionID } = submission
                const connection = await Connection.findOne({
                  where: { id: connectionID }
                })
                if (connection) {
                  request.post({
                    uri: `${URL}/admin/quovo-fetch-connection-updates`,
                    body: {
                      secret: process.env.apiSecret,
                      data: {
                        userID,
                        quovoConnectionID: connection.quovoConnectionID
                      }
                    },
                    json: true
                  })
                  responseMsg = `Initiated the Quovo Sync for Connection ${connectionID} of User ${userID}`
                } else {
                  responseMsg = `Connection ${connectionID} not found for User ${userID}`
                }
                break

              case KEYWORDS.ACCOUNT:
                const { accountID } = submission
                const account = await Account.findOne({
                  where: { id: accountID }
                })
                if (account) {
                  // Update Accounts
                  await Account.update(
                    { isDefault: false },
                    { where: { userID, connectionID: account.connectionID } }
                  )
                  await account.update({ isDefault: true })

                  // Update Connections
                  await Connection.update(
                    { isDefault: false },
                    { where: { userID } }
                  )
                  await Connection.update(
                    { isDefault: true },
                    { where: { userID, id: account.connectionID } }
                  )

                  responseMsg = `Successfully updated default account ${accountID} for User ${userID}`
                  break
                } else {
                  responseMsg = `Account ${accountID} not found for User ${userID}`
                }
                break

              case KEYWORDS.ACH:
                const {
                  accountID: achAccountID,
                  institution,
                  transit,
                  number
                } = submission
                const achAccount = await Account.findOne({
                  where: { id: achAccountID }
                })
                if (achAccount) {
                  await achAccount.update({ institution, transit, number })
                  responseMsg = `Successfully updated bank info for User ${userID}`
                } else {
                  responseMsg = `Account ${achAccountID} not found for User ${userID}`
                }
                break

              case KEYWORDS.GENERAL:
                const {
                  firstName,
                  lastName,
                  email,
                  phone,
                  isActive
                } = submission
                user.firstName = firstName
                user.lastName = lastName
                user.email = email
                user.phone = phone
                user.isActive = isActive === '1'
                await user.save()
                responseMsg = `Successfully updated general info for User ${userID}`
                break

              case KEYWORDS.PREFERENCES:
                const {
                  daysToNextSave,
                  savingType,
                  fetchFrequency,
                  fixedContribution
                } = submission
                user.nextSaveDate = moment().add(
                  +daysToNextSave === 0 ? 1 : +daysToNextSave,
                  'd'
                )
                user.savingType = savingType
                user.fetchFrequency = fetchFrequency
                user.fixedContribution = Math.round(
                  Math.abs(+fixedContribution) * 100
                )
                await user.save()
                responseMsg = `Successfully updated saving preferences info for User ${userID}`
                break
            }
          } else {
            responseMsg = `No user found for ID: ${userID}`
          }
        } catch (e) {
          responseMsg = `Update Failed for User ${userID}`
        }

        ctx.body = responseMsg
      }
    }
  }
}
