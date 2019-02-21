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
                  data: { userID: user.id }
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
      ['data', true, [['userID', true, 'integer'], ['amount', 'integer']]]
    ],
    async method (ctx) {
      const {
        data: { userID, amount: amountProvided }
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

                  let safeBalance = defaultAccount.value
                  let amountToSave = 0
                  if (amountProvided) {
                    amountToSave = amountProvided
                  } else {
                    // Get amount to save
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
                  }

                  if (amountToSave && safeBalance) {
                    const amountCalculated = amountToSave

                    if (
                      !amountProvided ||
                      (amountProvided >= MIN_DEPOSIT_AMOUNT &&
                        amountProvided <= MAX_DEPOSIT_AMOUNT)
                    ) {
                      // Amount is auto-calculated OR the provided amount is in proper range
                      amountToSave = Math.min(
                        Math.max(amountCalculated, MIN_DEPOSIT_AMOUNT),
                        MAX_DEPOSIT_AMOUNT
                      )

                      amplitude.track({
                        eventType: 'WORKER_GOT_AMOUNT',
                        userId: user.id,
                        eventProperties: {
                          AccountID: defaultAccount.id,
                          SavingType: user.savingType,
                          AmountProvided: amountProvided,
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
                            uri: `${
                              config.constants.URL
                            }/admin/worker-transfer`,
                            body: {
                              secret: process.env.apiSecret,
                              data: {
                                userID: user.id,
                                amount: amountToSave,
                                type: 'debit',
                                requestMethod: amountProvided
                                  ? 'ThriveBot'
                                  : 'Automated'
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
                            SavingType: user.savingType,
                            AmountCalculated: amountCalculated,
                            AmountToSave: amountToSave,
                            AccountBalance: defaultAccount.balance,
                            SafeBalance: safeBalance
                          }
                        })

                        // Schedule user to run daily till we are able to pull
                        await user.update({ forcedFetchFrequency: 'ONCEDAILY' })

                        reply.error = true
                        reply.errorCode = 'low_balance'
                      }
                    } else {
                      // Provided amount is in range
                      const bounds = {
                        lower: MIN_DEPOSIT_AMOUNT,
                        upper: MAX_DEPOSIT_AMOUNT
                      }
                      reply.error = true
                      reply.errorCode = 'out_of_range'
                      reply.errorDetails = bounds

                      amplitude.track({
                        eventType: 'WORKER_RUN_USER_FAIL',
                        userId: 'server',
                        eventProperties: {
                          Error: `Amount out of range.`,
                          AmountProvided: amountProvided,
                          Bounds: bounds
                        }
                      })
                    }
                  } else {
                    reply.error = true
                    amplitude.track({
                      eventType: 'WORKER_RUN_USER_FAIL',
                      userId: user.id,
                      eventProperties: {
                        Error: 'AmountToSave or SafeBalance is null',
                        AmountToSave: amountToSave,
                        SafeBalance: safeBalance
                      }
                    })
                  }
                } else {
                  reply.error = true
                  reply.errorCode = 'no_default'
                  amplitude.track({
                    eventType: 'WORKER_RUN_USER_FAIL',
                    userId: user.id,
                    eventProperties: {
                      Error: `Connection ${
                        defaultConnection.id
                      } of User ${userID} has no default account.`
                    }
                  })
                }
              } else {
                reply.error = true
                reply.errorCode = 'no_default'
                amplitude.track({
                  eventType: 'WORKER_RUN_USER_FAIL',
                  userId: user.id,
                  eventProperties: {
                    Error: `Connection ${
                      defaultConnection.id
                    } of User ${userID} has no accounts.`
                  }
                })
              }
            } else {
              reply.error = true
              reply.errorCode = 'no_default'
              amplitude.track({
                eventType: 'WORKER_RUN_USER_FAIL',
                userId: user.id,
                eventProperties: {
                  Error: `User ${userID} has no default bank connection.`
                }
              })
            }
          } else {
            reply.error = true
            reply.errorCode = 'no_bank'
            amplitude.track({
              eventType: 'WORKER_RUN_USER_FAIL',
              userId: user.id,
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

      const reply = {}
      const user = await User.findOne({ where: { id: userID } })

      if (user) {
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
      } else {
        reply.error = true
        amplitude.track({
          eventType: 'WORKER_TRANSFER_FAIL',
          userId: 'server',
          eventProperties: {
            Error: `User ${userID} was not found.`
          }
        })
      }

      ctx.body = reply
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
  },

  monthlyStatement: {
    async method (ctx) {
      const users = await User.findAll({ where: { bankLinked: true } })

      if (users.length > 0) {
        Bluebird.all(
          users.map(user =>
            request.post({
              uri: `${
                config.constants.URL
              }/admin/notifications-statement-email`,
              body: {
                secret: process.env.apiSecret,
                data: {
                  userID: user.id
                }
              },
              json: true
            })
          )
        )
      }

      ctx.body = {}
    }
  },

  notifyAboutSchedulerRun: {
    schema: [['data', true, [['task', true]]]],
    async method (ctx) {
      const {
        data: { task }
      } = ctx.request.body

      await request.post({
        uri: process.env.slackWebhookURL,
        body: { text: `Scheduler ran for task: ${task}` },
        json: true
      })

      ctx.body = {}
    }
  }
})
