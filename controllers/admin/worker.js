module.exports = (Bluebird, Sequelize, User, request, amplitude, config) => ({
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
          bankLinked: true
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
            Balance: `${balance}`
          }
        })

        // Transfer the amount
        if (
          safeBalance > BALANCE_LOWER_THRESHOLD &&
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
              uri: `${config.constants.URL}/slack-request-approval`,
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
    schema: [['data', true, [['payload', true, 'object']]]],
    async method (ctx) {
      const {
        data: { payload }
      } = ctx.request.body

      const {
        actions: [{ value }],
        original_message: originalMessage,
        callback_id: callbackId,
        trigger_id,
        response_url: responseUrl
      } = payload

      const [, userID, amount] = callbackId.split('_')

      const user = await User.findOne({ where: { id: userID } })
      if (!user) {
        return Bluebird.reject([
          { key: 'user', value: `User not found for ID: ${userID}` }
        ])
      }

      let replyMessage = Object.assign({}, originalMessage)
      replyMessage.attachments = []

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
        replyMessage.text += '\n*Proceeding the transfer.*'
      } else if (value === 'no') {
        replyMessage.text += '\n*Transfer cancelled.*'
      } else if (value === 'auto') {
        user.update({ requireApproval: false })
        replyMessage.text += '\n*Understood.*'
      } else {
        request.post({
          uri: `${config.constants.URL}/slack-api-call`,
          body: {
            data: {
              url: 'dialog.open',
              body: {
                dialog: JSON.stringify({
                  callback_id: `changeAmount_${userID}`,
                  title: 'Choose a new amount',
                  submit_label: 'Transfer',
                  elements: [
                    {
                      type: 'text',
                      label: 'Amount:',
                      name: 'amount',
                      hint: 'Example amount format: 10.25',
                      max_length: 6,
                      min_length: 1
                    }
                  ],
                  state: responseUrl
                }),
                trigger_id
              }
            }
          },
          json: true
        })
        replyMessage = originalMessage
      }

      ctx.body = replyMessage
    }
  }
})
