module.exports = (
  Sequelize,
  User,
  Connection,
  Account,
  Queue,
  Bonus,
  Goal,
  Bluebird,
  request,
  config,
  moment,
  amplitude
) => ({
  notifyAboutSchedulerRun: {
    schema: [['data', true, [['job', true]]]],
    async method (ctx) {
      const {
        data: { job }
      } = ctx.request.body

      await request.post({
        uri: process.env.slackWebhookURL,
        body: { text: `Scheduler ran for job: ${job}` },
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
          ['type', true]
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { userID, amount, type }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: userID } })
      if (!user) {
        return Bluebird.reject([
          { key: 'User', value: `User not found for ID: ${userID}` }
        ])
      }

      // Create queue entry
      await request.post({
        uri: `${config.constants.URL}/admin/queue-create`,
        body: {
          secret: process.env.apiSecret,
          data: {
            userID,
            amountInCents: amount,
            type,
            requestMethod: 'ManualUpdate',
            processed: true
          }
        },
        json: true
      })

      await user.updateBalance(amount, type)
      ctx.body = {}
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
    schema: [['data', true, [['userID', true, 'integer'], ['message', true]]]],
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
            uri: `${config.constants.URL}/admin/company-add`,
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
            uri: `${config.constants.URL}/slack-request-algo-approval`,
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
          await request.post({
            uri: `${config.constants.URL}/admin/worker-transfer`,
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
          responseMsg = `Direct Tranfer for User ${userID} - too large amount to save`
        } else {
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
            uri: `${config.constants.URL}/admin/versapay-sync`,
            body: {
              secret: process.env.apiSecret,
              data: { userID, institution, transit, account }
            },
            json: true
          })

          amplitude.track({
            eventType: 'MANUAL_DIRECT_TRANSFER_DONE',
            userId: userID,
            eventProperties: {
              Amount: amount,
              TransactionType: type,
              RequestMethod: requestMethod
            }
          })
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
          uri: `${config.constants.URL}/admin/company-top-up-user`,
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

      console.log(submission)

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
                  uri: `${
                    config.constants.URL
                  }/admin/quovo-fetch-connection-updates`,
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
              const { firstName, lastName, email, phone, isActive } = submission
              user.firstName = firstName
              user.lastName = lastName
              user.email = email
              user.phone = phone
              user.isActive = isActive === '1'
              console.log(user.isActive)
              console.log('-------------------')
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
              user.fixedContribution = parseInt((fixedContribution + 0) * 100)
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
})
