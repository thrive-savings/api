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
  moment,
  amplitude
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

    fixProcessedDates: {
      async method (ctx) {
        const queues = await Queue.findAll({
          where: { processed: true, processedDate: null }
        })
        for (const queue of queues) {
          queue.update({ processedDate: queue.createdAt })
        }

        ctx.body = {}
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
                queueSum: 0,
                transferSum: 0,
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
                  createdAt,
                  processedDate,
                  versapay_token: versapayToken,
                  uuid,
                  accountID,
                  userID
                } of queues) {
                  reply.users[userID].queueSum +=
                    type === 'credit' ? -1 * amount : amount

                  const transferData = {
                    amount,
                    type: type === 'credit' ? TYPES.CREDIT : TYPES.DEBIT,
                    subtype:
                      type === 'credit' ? SUBTYPES.WITHDRAW : SUBTYPES.SAVE,
                    stateRaw: state,
                    platformID: versapayToken,
                    createdAt,
                    updatedAt: processedDate,
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
                      imported: true
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
                      case 'canceled':
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
                      break
                    case 'MomentumOffer':
                      transferData.subtype = SUBTYPES.MATCH
                      transferData.extra.memo += ' - momentum offer bonus'
                      break
                    case 'InAppRequest':
                      transferData.extra.memo += ' - goal withdrawal'
                      break
                    case 'USER_IMPORTED':
                      transferData.extra.memo +=
                        ' - imported from the beta system'
                      break
                  }

                  const transfer = await Transfer.create(transferData)
                  reply.users[userID].transferSum +=
                    transfer.type === TYPES.CREDIT
                      ? -1 * transfer.amount
                      : transfer.amount
                  reply.users[userID].transfers.push(transfer.getData())

                  await transfer.update({ uuid })
                }
              }

              const userReplyData = reply.users[user.id]
              if (userReplyData.transferSum !== userReplyData.balance) {
                request.post({
                  uri: process.env.slackWebhookURL,
                  body: {
                    text: `Transfer Data Import - *dismatch detected*: \n - User: ${
                      user.firstName
                    } ${user.lastName} | ID ${user.id}\n - Balance: ${
                      userReplyData.balance
                    }\n - Transfer Sum: ${
                      userReplyData.transferSum
                    }\n - Queue Sum: ${userReplyData.queueSum}`
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
                historySum: 0,
                queueSum: 0,
                bonusSum: 0,
                goalProgressSum: 0
              }
            }

            const queues = await Queue.findAll({
              where: { userID: user.id, type: { [Sequelize.Op.ne]: 'bonus' } },
              order: [['id']]
            })
            for (const queue of queues) {
              if (queue.state === 'completed') {
                const amountDelta =
                  queue.type === 'credit' ? -1 * queue.amount : queue.amount
                reply.users[user.id].historySum += amountDelta
                reply.users[user.id].queueSum += amountDelta
              }
            }

            const bonuses = await Bonus.findAll({
              where: { userID: user.id },
              order: [['id']]
            })
            for (const bonus of bonuses) {
              const amountDelta = bonus.amount
              reply.users[user.id].historySum += amountDelta
              reply.users[user.id].bonusSum += amountDelta
            }

            reply.users[user.id].goalProgressSum = await Goal.sum('progress', {
              where: { userID: user.id }
            })
          }

          reply.matches = []
          reply.dismatches = []
          for (const key of Object.keys(reply.users)) {
            const { balance, historySum } = reply.users[key]
            if (balance === historySum) {
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

    transfer: {
      schema: [
        [
          'data',
          true,
          [
            ['userID', true, 'integer'],
            ['amount', true, 'integer'],
            ['type', true]
          ]
        ]
      ],
      async method (ctx) {
        const {
          data: { userID, amount, type }
        } = ctx.request.body

        let responseMsg = `Processing the transfer for User ${userID}`
        try {
          if (amount >= 5000 && type === 'debit') {
            await request.post({
              uri: `${URL}/slack-request-algo-approval`,
              body: {
                data: {
                  userID: parseInt(userID),
                  amount
                }
              },
              json: true
            })
            responseMsg = ''
          } else {
            const transferResult = await request.post({
              uri: `${URL}/admin/worker-transfer`,
              body: {
                secret: process.env.apiSecret,
                data: {
                  userID,
                  amount,
                  type,
                  requestMethod: 'Manual'
                }
              },
              json: true
            })

            if (!transferResult.error) {
              const user = await User.findOne({ where: { id: userID } })
              if (user) {
                user.setNextSaveDate()
              }
            }
          }
        } catch (e) {
          responseMsg = `Transfer failed for User ${userID}`
        }

        ctx.body = responseMsg
      }
    },

    transferDirect: {
      schema: [
        [
          'data',
          true,
          [
            ['userID', true, 'integer'],
            ['amount', true, 'integer'],
            ['institution', true],
            ['transit', true],
            ['account', true]
          ]
        ]
      ],
      async method (ctx) {
        const {
          data: { userID, amount: givenAmount, institution, transit, account }
        } = ctx.request.body

        let responseMsg = `Processing the transfer for User ${userID}`
        try {
          const requestMethod = 'ManualDirect'
          const type = givenAmount > 0 ? 'debit' : 'credit'
          const amount = givenAmount > 0 ? givenAmount : -1 * givenAmount

          if (type === 'debit' && amount > 20000) {
            responseMsg = `Direct Transfer for User ${userID} - too large amount to save`
          } else {
            const user = await User.findOne({ where: { id: userID } })
            if (user) {
              // Create Queue entry
              await Queue.create({
                userID,
                amount,
                type,
                requestMethod,
                transactionReference: `THRIVE${userID}_` + moment().format('X')
              })

              // Deposit to VersaPay
              await request.post({
                uri: `${URL}/admin/versapay-sync`,
                body: {
                  secret: process.env.apiSecret,
                  data: { userID, institution, transit, account }
                },
                json: true
              })

              // Set Next Save Date
              user.setNextSaveDate()

              amplitude.track({
                eventType: 'MANUAL_DIRECT_TRANSFER_DONE',
                userId: userID,
                eventProperties: {
                  Amount: amount,
                  TransactionType: type,
                  RequestMethod: requestMethod
                }
              })
            } else {
              responseMsg = `Direct Transfer couldn't find User for ID ${userID}`
            }
          }
        } catch (e) {
          responseMsg = `Direct Transfer failed for User ${userID}`
        }

        ctx.body = responseMsg
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
