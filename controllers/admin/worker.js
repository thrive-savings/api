module.exports = (Bluebird, User, request, amplitude, config) => ({
  runFrequency: {
    schema: [['data', true, [['frequencyWord', true]]]],
    async method (ctx) {
      const { frequencyWord } = ctx.request.body.data

      const users = await User.findAll({
        where: { fetchFrequency: frequencyWord, bankLinked: true }
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

      const user = await User.findOne({ where: { id: userID } })
      if (!user) {
        return Bluebird.reject([
          { key: 'User', value: `User not found for ID: ${userID}` }
        ])
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
          eventType: 'WORKER_GOT_BALANCE',
          userId: user.id,
          eventProperties: {
            Frequency: `${frequencyWord}`,
            SavingType: `${user.savingType}`,
            Balance: `${balance}`
          }
        })

        // Get  saving amount
        let amount
        if (user.savingType === 'Thrive Flex') {
          const algoResult = await request.post({
            uri: `${config.constants.URL}/admin/algo-run`,
            body: {
              secret: process.env.apiSecret,
              data: { userID: user.id }
            },
            json: true
          })
          amount = algoResult.amount
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
            Balance: `${balance}`
          }
        })

        // Transfer the amount
        if (balance > BALANCE_LOWER_THRESHOLD && amount < MAX_DEPOSIT_AMOUNT) {
          if (user.requireApproval || user.userType === 'vip') {
            await request.post({
              uri: `${config.constants.URL}/slack-request-approval`,
              body: {
                data: {
                  userID: user.id,
                  amount
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
              Reason: 'Low Balance or High Amount'
            }
          })
        }
      } catch (error) {
        console.log('------Catched inside WORK_RUN_USER------')
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
        console.log('------Catched inside WORKER_TRANSFER------')
        amplitude.track({
          eventType: 'WORKER_TRANSFER_FAIL',
          userId: user.id,
          eventProperties: { error }
        })
      }

      ctx.body = {}
    }
  },

  handleApproval: {
    schema: [
      [
        'data',
        true,
        [
          ['value', true],
          ['params', true, 'array'],
          ['originalMessage', true, 'object']
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: {
          value,
          params: [userID, amount],
          originalMessage
        }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: userID } })
      if (!user) {
        return Bluebird.reject([
          { key: 'user', value: `User not found for ID: ${userID}` }
        ])
      }

      originalMessage.attachments = []

      if (value === 'yes') {
        request.post({
          uri: `${config.constants.URL}/admin/worker-transfer`,
          body: {
            secret: process.env.apiSecret,
            data: {
              userID: parseInt(userID),
              amount: parseInt(amount),
              type: 'debit',
              requestMethod: 'AutomatedApproved'
            }
          },
          json: true
        })
        originalMessage.text += '\n*Proceeding the transfer.*'
      } else if (value === 'no') {
        originalMessage.text += '\n*Transfer cancelled.*'
      } else {
        user.update({ requireApproval: false })
        originalMessage.text += '\n*Understood.*'
      }

      ctx.body = originalMessage
    }
  }
})
