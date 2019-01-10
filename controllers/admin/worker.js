module.exports = (
  Bluebird,
  Sequelize,
  User,
  Institution,
  Connection,
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

      const reply = {}
      try {
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
            Frequency: frequencyWord,
            UserCount: users ? users.length : 0
          }
        })

        if (users && users.length > 0) {
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
      } catch (e) {
        reply.error = true
        amplitude.track({
          eventType: 'WORKER_RUN_FREQUENCY_FAIL',
          userId: 'server',
          eventProperties: {
            Error: e
          }
        })
      }

      ctx.body = reply
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

      const MIN_BALANCE_THRESHOLD = 10000
      const MIN_DEPOSIT_AMOUNT = 500
      const MAX_DEPOSIT_AMOUNT = 100000

      const reply = {}

      try {
        ctx.request.socket.setTimeout(5 * 60 * 1000)

        const user = await User.findOne({
          include: [{ model: Connection, include: [Account] }],
          where: { id: userID }
        })

        if (user) {
          const connections = user.connections
          if (connections && connections.length > 0) {
            let defaultConnection = connections.filter(
              connection => connection.isDefault
            )
            if (defaultConnection && defaultConnection.length > 0) {
              defaultConnection = defaultConnection[0]
              const accounts = defaultConnection.accounts

              if (accounts) {
                let defaultAccount = accounts.filter(
                  account => account.isDefault
                )

                if (defaultAccount && defaultAccount.length > 0) {
                  defaultAccount = defaultAccount[0]

                  amplitude.track({
                    eventType: 'WORKER_GOT_DEFAULT_ACCOUNT',
                    userId: user.id,
                    eventProperties: {
                      DefaultConnectionID: defaultConnection.id,
                      DefaultAccountID: defaultAccount.id
                    }
                  })

                  // Get amount to save
                  let safeBalance = defaultAccount.value
                  let amountToSave = 0

                  if (user.savingType === 'Thrive Flex') {
                    const {
                      error: algoRunError,
                      safeBalance: safeBalanceFromAlgo,
                      amount: amountFromAlgo
                    } = await request.post({
                      uri: `${config.constants.URL}/admin/algo-run`,
                      body: {
                        secret: process.env.apiSecret,
                        data: { userID: user.id }
                      },
                      json: true
                    })
                    if (!algoRunError) {
                      safeBalance = safeBalanceFromAlgo
                      amountToSave = amountFromAlgo
                    }
                  } else {
                    amountToSave = user.fixedContribution
                  }

                  if (amountToSave && safeBalance) {
                    const amountCalculated = amountToSave
                    amountToSave = Math.min(
                      Math.max(amountCalculated, MIN_DEPOSIT_AMOUNT),
                      MAX_DEPOSIT_AMOUNT
                    )

                    amplitude.track({
                      eventType: 'WORKER_GOT_AMOUNT',
                      userId: user.id,
                      eventProperties: {
                        AccountID: defaultAccount.id,
                        Frequency: frequencyWord,
                        SavingType: user.savingType,
                        AmountCalculated: amountCalculated,
                        AmountToSave: amountToSave,
                        AccountBalance: defaultAccount.balance,
                        SafeBalance: safeBalance
                      }
                    })

                    if (safeBalance > MIN_BALANCE_THRESHOLD) {
                      if (user.forcedFetchFrequency) {
                        user.update({ forcedFetchFrequency: null })
                      }

                      if (user.requireApproval || user.userType === 'vip') {
                        // Request approval
                        amplitude.track({
                          eventType: 'WORKER_REQUESTED_APPROVAL',
                          userId: user.id,
                          eventProperties: {
                            SavingType: user.savingType,
                            Amount: amountToSave
                          }
                        })
                        await request.post({
                          uri: `${
                            config.constants.URL
                          }/slack-request-algo-approval`,
                          body: {
                            data: {
                              userID: user.id,
                              amount: parseInt(amountToSave)
                            }
                          },
                          json: true
                        })
                      } else {
                        // Do the transfer
                        await request.post({
                          uri: `${config.constants.URL}/admin/worker-transfer`,
                          body: {
                            secret: process.env.apiSecret,
                            data: {
                              userID: user.id,
                              amount: amountToSave,
                              type: 'debit',
                              requestMethod: 'Automated'
                            }
                          },
                          json: true
                        })
                      }
                    } else {
                      amplitude.track({
                        eventType: 'WORKER_FOUND_LOW_BALANCE',
                        userId: user.id,
                        eventProperties: {
                          AccountID: defaultAccount.id,
                          Frequency: frequencyWord,
                          SavingType: user.savingType,
                          AmountCalculated: amountCalculated,
                          AmountToSave: amountToSave,
                          AccountBalance: defaultAccount.balance,
                          SafeBalance: safeBalance
                        }
                      })

                      // Schedule user to run daily till we are able to pull
                      await user.update({ forcedFetchFrequency: 'ONCEDAILY' })
                    }
                  }
                } else {
                  reply.error = true
                  amplitude.track({
                    eventType: 'WORKER_RUN_USER_FAIL',
                    userId: 'server',
                    eventProperties: {
                      Error: `Connection ${
                        defaultConnection.id
                      } of User ${userID} has no default account.`
                    }
                  })
                }
              } else {
                reply.error = true
                amplitude.track({
                  eventType: 'WORKER_RUN_USER_FAIL',
                  userId: 'server',
                  eventProperties: {
                    Error: `Connection ${
                      defaultConnection.id
                    } of User ${userID} has no accounts.`
                  }
                })
              }
            } else {
              reply.error = true
              amplitude.track({
                eventType: 'WORKER_RUN_USER_FAIL',
                userId: 'server',
                eventProperties: {
                  Error: `User ${userID} has no default bank connection.`
                }
              })
            }
          } else {
            reply.error = true
            amplitude.track({
              eventType: 'WORKER_RUN_USER_FAIL',
              userId: 'server',
              eventProperties: {
                Error: `User ${userID} has no bank connections.`
              }
            })
          }
        } else {
          reply.error = true
          amplitude.track({
            eventType: 'WORKER_RUN_USER_FAIL',
            userId: 'server',
            eventProperties: {
              Error: `User not found for ID: ${userID}`
            }
          })
        }
      } catch (e) {
        reply.error = true
        amplitude.track({
          eventType: 'WORKER_RUN_USER_FAIL',
          userId: 'server',
          eventProperties: {
            Error: `User not found for ID: ${userID}`
          }
        })
      }

      ctx.body = reply
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
  },

  fetchDailyUpdates: {
    async method (ctx) {
      const users = await User.findAll({
        where: { quovoUserID: { [Sequelize.Op.ne]: null } }
      })

      if (users.length > 0) {
        await request.post({
          uri: `${config.constants.URL}/admin/quovo-api-token`,
          body: {
            secret: process.env.apiSecret
          },
          json: true
        })

        Bluebird.all(
          users.map(user =>
            request.post({
              uri: `${config.constants.URL}/admin/quovo-fetch-user-updates`,
              body: {
                secret: process.env.apiSecret,
                data: {
                  quovoUserID: user.quovoUserID
                }
              },
              json: true
            })
          )
        )
      }

      ctx.body = {}
    }
  }
})
