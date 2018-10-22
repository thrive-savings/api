module.exports = (
  Bluebird,
  Sequelize,
  User,
  Account,
  request,
  amplitude,
  config,
  emoji,
  Sentry
) => ({
  runFrequency: {
    schema: [['data', true, [['frequencyWord', true]]]],
    async method (ctx) {
      const { frequencyWord } = ctx.request.body.data

      // Condition Explanation: (forcedFetchFrequency = frequencyWord or (fetchFrequency = frequencyword and forcedFetchFrequency = null))
      const users = await User.findAll({
        where: {
          [Sequelize.Op.or]: [
            { forcedFetchFrequency: frequencyWord },
            {
              [Sequelize.Op.and]: [
                { fetchFrequency: frequencyWord },
                { forcedFetchFrequency: null }
              ]
            }
          ],
          bankLinked: true,
          relinkRequired: false
        }
      })
      amplitude.track({
        eventType: 'WORKER_RUN_FREQUENCY',
        userId: 'server',
        eventProperties: {
          Frequency: `${frequencyWord}`,
          UserCount: `${users.length}`
        }
      })

      if (users.length > 0) {
        Bluebird.all(
          users.map(user =>
            request.post({
              uri: `${config.constants.URL}/admin/worker-run-user`,
              body: {
                secret: process.env.apiSecret,
                data: { userID: user.id, frequencyWord }
              },
              json: true
            })
          )
        )
      }

      ctx.body = {}
    }
  },

  runUser: {
    schema: [
      ['data', true, [['userID', true, 'integer'], ['frequencyWord', true]]]
    ],
    async method (ctx) {
      const {
        data: { userID, frequencyWord }
      } = ctx.request.body

      const BALANCE_LOWER_THRESHOLD = 15000
      const MAX_DEPOSIT_AMOUNT = 100000

      const user = await User.findOne({
        where: { id: userID, bankLinked: true, relinkRequired: false }
      })
      if (!user) {
        return Bluebird.reject([
          { key: 'User', value: `User not found for ID: ${userID}` }
        ])
      }

      // Don't run for TD users
      const defaultAccount = await Account.findOne({
        where: { userID, isDefault: true }
      })
      if (defaultAccount && defaultAccount.bank === 'TD') {
        amplitude.track({
          eventType: 'TD_USER',
          userId: user.id
        })
        ctx.body = {}
        return
      }

      try {
        // Fetch new transactions for user
        const {
          data: { balance }
        } = await request.post({
          uri: `${config.constants.URL}/admin/transactions-fetch-user`,
          body: { secret: process.env.apiSecret, data: { userID: user.id } },
          json: true
        })

        amplitude.track({
          eventType: 'WORKER_FETCHED_TRANSACTIONS',
          userId: user.id,
          eventProperties: {
            Frequency: `${frequencyWord}`,
            SavingType: `${user.savingType}`,
            Balance: `${balance}`
          }
        })

        // Get  saving amount
        let safeBalance = balance
        let amount
        if (user.savingType === 'Thrive Flex') {
          const algoResult = await request.post({
            uri: `${config.constants.URL}/admin/algo-run-new`,
            body: {
              secret: process.env.apiSecret,
              data: { userID: user.id }
            },
            json: true
          })
          amount = algoResult.amount
          safeBalance = algoResult.safeBalance || balance
        } else {
          amount = user.fixedContribution
        }

        amplitude.track({
          eventType: 'WORKER_GOT_AMOUNT',
          userId: user.id,
          eventProperties: {
            Frequency: `${frequencyWord}`,
            SavingType: `${user.savingType}`,
            Amount: `${amount}`,
            Balance: `${balance}`,
            SafeBalance: `${safeBalance}`
          }
        })

        // Transfer the amount
        if (
          safeBalance &&
          safeBalance > BALANCE_LOWER_THRESHOLD &&
          amount &&
          amount < MAX_DEPOSIT_AMOUNT
        ) {
          // Reset user forced frequency
          if (user.forcedFetchFrequency) {
            user.update({ forcedFetchFrequency: null })
          }

          if (user.requireApproval || user.userType === 'vip') {
            amplitude.track({
              eventType: 'WORKER_REQUESTED_APPROVAL',
              userId: user.id,
              eventProperties: {
                SavingType: `${user.savingType}`,
                Amount: `${amount}`,
                Balance: `${balance}`,
                SafeBalance: `${safeBalance}`
              }
            })
            await request.post({
              uri: `${config.constants.URL}/slack-request-algo-approval`,
              body: {
                data: {
                  userID: user.id,
                  amount: parseInt(amount)
                }
              },
              json: true
            })
          } else {
            await request.post({
              uri: `${config.constants.URL}/admin/worker-transfer`,
              body: {
                secret: process.env.apiSecret,
                data: {
                  userID: user.id,
                  amount,
                  type: 'debit',
                  requestMethod: 'Automated'
                }
              },
              json: true
            })
          }
        } else {
          amplitude.track({
            eventType: 'WORKER_NO_TRANSFER',
            userId: user.id,
            eventProperties: {
              Frequency: `${frequencyWord}`,
              SavingType: `${user.savingType}`,
              Amount: `${amount}`,
              Balance: `${balance}`,
              SafeBalance: `${safeBalance}`,
              Reason: 'Low Balance or High Amount'
            }
          })

          // Schedule user to run daily till we are able to pull
          await user.update({ forcedFetchFrequency: 'ONCEDAILY' })
        }
      } catch (error) {
        Sentry.captureException(error)
        amplitude.track({
          eventType: 'WORKER_RUN_USER_FAIL',
          userId: user.id,
          eventProperties: { error }
        })
      }

      ctx.body = {}
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
          ['type', true],
          ['requestMethod', true]
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { userID, amount, type, requestMethod }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: userID } })
      if (!user) {
        return Bluebird.reject([
          { key: 'User', value: `User not found for ID: ${userID}` }
        ])
      }

      try {
        // Create queue entry
        await request.post({
          uri: `${config.constants.URL}/admin/queue-create`,
          body: {
            secret: process.env.apiSecret,
            data: { userID, amountInCents: amount, type, requestMethod }
          },
          json: true
        })

        // Deposit to VersaPay
        await request.post({
          uri: `${config.constants.URL}/admin/versapay-sync`,
          body: { secret: process.env.apiSecret, data: { userID } },
          json: true
        })

        amplitude.track({
          eventType: 'WORKER_TRANSFER_DONE',
          userId: userID,
          eventProperties: {
            Amount: amount,
            TransactionType: type,
            RequestMethod: requestMethod
          }
        })
      } catch (error) {
        Sentry.captureException(error)
        amplitude.track({
          eventType: 'WORKER_TRANSFER_FAIL',
          userId: user.id,
          eventProperties: { error }
        })
      }

      ctx.body = {}
    }
  },

  sendBoostNotification: {
    async method (ctx) {
      const MIN_BALANCE_TO_SEND_BOOST = 3000
      const users = await User.findAll({
        where: { balance: { [Sequelize.Op.gt]: MIN_BALANCE_TO_SEND_BOOST } }
      })

      const onMissing = name =>
        name === 'thumbsup' ? '1:' : name === 'fire' ? '2:' : '3:'
      const msg =
        'Are we saving the right amount for you?\n\nYou can change how much to save next time by replying with one of the options below:\n\n:thumbsup: "Boost 1.5x" - Save 1.5x more\n:fire: "Boost 2x" - Save twice as much\n:thumbsdown: "Reduce 0.5x" - Save 50% less'

      users.forEach(user => {
        user.sendMessage(emoji.emojify(msg, onMissing))
      })

      amplitude.track({
        eventType: 'BOOST_NOTIFICATION_SENT',
        userId: 'server',
        eventProperties: {
          UserCount: `${users.length}`
        }
      })

      ctx.body = {}
    },
    onError (err) {
      Sentry.captureException(err)
    }
  }
})
