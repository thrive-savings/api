module.exports = (
  Bluebird,
  Sequelize,
  User,
  Connection,
  Account,
  amplitude,
  request,
  config,
  moment
) => ({
  run: {
    async method (ctx) {
      const reply = {}

      try {
        const users = await User.findAll({
          where: {
            nextSaveDate: {
              [Sequelize.Op.gt]: moment().subtract(1, 'd'),
              [Sequelize.Op.lt]: moment().add(1, 'd')
            },
            isActive: true
          }
        })

        amplitude.track({
          eventType: 'SAVER_RAN',
          userId: 'server',
          eventProperties: {
            UserCount: users ? users.length : 0
          }
        })

        if (users && users.length > 0) {
          Bluebird.all(
            users.map(user =>
              request.post({
                uri: `${config.constants.URL}/admin/saver-run-user`,
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
        reply.errorCode = 'try_catched'
        amplitude.track({
          eventType: 'SAVER_RUN_FAIL',
          userId: 'server',
          eventProperties: {
            error: e,
            errorCode: reply.errorCode
          }
        })
      }

      ctx.body = reply
    }
  },

  runUser: {
    schema: [['data', true, [['userID', true, 'integer']]]],
    async method (ctx) {
      const {
        data: { userID }
      } = ctx.request.body

      const reply = {}

      try {
        let analyticsMessage = ''
        const user = await User.findOne({ where: { id: userID } })
        if (user) {
          const daysToNextSave = user.daysToNextSave()

          if (daysToNextSave === 0) {
            analyticsMessage = 'Try to save'
            request.post({
              uri: `${config.constants.URL}/admin/saver-try-save`,
              body: {
                secret: process.env.apiSecret,
                data: { userID }
              },
              json: true
            })
          } else if (daysToNextSave === 1) {
            analyticsMessage = 'Tomorrow is the save day'
            const daysFromSignUp = moment().diff(moment(user.createdAt), 'd')
            if (daysFromSignUp > 1) {
              const connections = await Connection.findAll({
                where: { userID }
              })
              if (!connections || connections.length === 0) {
                analyticsMessage += ' - Reminded user to link bank'
                user.sendMessage(
                  `Hi ${
                    user.firstName
                  }, friendly reminder from ThriveBot - Remember to link your bank account in App. I will be saving for you on ${moment(
                    user.nextSaveDate
                  ).format('dddd MMMM Do')}! Happy saving!`
                )
              }
            }
          } else {
            analyticsMessage =
              daysToNextSave < 0
                ? 'Next Save Date is in the past'
                : 'No action needs to be taken'
          }

          amplitude.track({
            eventType: 'SAVER_RUN_USER_EXIT',
            userId: userID,
            eventProperties: {
              message: analyticsMessage,
              daysToNextSave
            }
          })
        } else {
          reply.error = true
          reply.errorCode = 'not_found'
          amplitude.track({
            eventType: 'SAVER_RUN_USER_FAIL',
            userId: userID,
            eventProperties: {
              errorCode: reply.errorCode
            }
          })
        }
      } catch (e) {
        reply.error = true
        reply.errorCode = 'try_catched'
        amplitude.track({
          eventType: 'SAVER_RUN_USER_FAIL',
          userId: userID,
          eventProperties: {
            error: e,
            errorCode: reply.errorCode
          }
        })
      }

      ctx.body = reply
    }
  },

  trySave: {
    schema: [
      [
        'data',
        true,
        [
          ['userID', true, 'integer'],
          ['amount', 'integer'],
          ['await', 'boolean']
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { userID, amount: amountProvided, await: waitToPerform }
      } = ctx.request.body

      let reply = {}

      try {
        const user = await User.findOne({
          include: [{ model: Connection, include: [Account] }],
          where: { id: userID }
        })
        if (user) {
          const {
            error: connectionError,
            connection,
            account
          } = user.getPrimaryAccount()

          if (!connectionError) {
            const requestParams = {
              uri: `${config.constants.URL}/admin/saver-perform-save`,
              body: {
                secret: process.env.apiSecret,
                data: {
                  userID: user.id,
                  connectionID: connection.id,
                  accountID: account.id,
                  amount: amountProvided
                }
              },
              json: true
            }
            if (waitToPerform) {
              reply = await request.post(requestParams)
            } else {
              request.post(requestParams)
            }
            amplitude.track({
              eventType: 'SAVER_TRY_PASS',
              userId: userID,
              eventProperties: {
                message: 'Initiated a call to SAVER_PERFORM_SAVE',
                connectionID: connection.id,
                accountID: account.id
              }
            })
          } else {
            if (connectionError === 'no_connections') {
              user.sendMessage(
                `Hi ${
                  user.firstName
                }, I couldn't save for you today because you haven't linked a bank. Please log into your Thrive App and link a bank to start saving!`
              )
            } else {
              request.post({
                uri: process.env.slackWebhookURL,
                body: {
                  text: `Saver *couldn't save* for *User ${userID}* because of *${connectionError}*`
                },
                json: true
              })
            }
            reply.error = true
            reply.errorCode = connectionError
            amplitude.track({
              eventType: 'SAVER_TRY_FAIL',
              userId: userID,
              eventProperties: {
                errorCode: connectionError
              }
            })
          }
        } else {
          reply.error = true
          reply.errorCode = 'not_found'
          amplitude.track({
            eventType: 'SAVER_TRY_FAIL',
            userId: userID,
            eventProperties: {
              errorCode: reply.errorCode
            }
          })
        }
      } catch (e) {
        reply.error = true
        reply.errorCode = 'try_catched'
        amplitude.track({
          eventType: 'SAVER_TRY_FAIL',
          userId: userID,
          eventProperties: {
            error: e,
            errorCode: reply.errorCode
          }
        })
      }

      ctx.body = reply
    }
  },

  performSave: {
    schema: [
      [
        'data',
        true,
        [
          ['userID', true, 'integer'],
          ['connectionID', true, 'integer'],
          ['accountID', true, 'integer'],
          ['amount', 'integer'] // only passed for MANUAL or ONE-TIME saves
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { userID, connectionID, accountID, amount: amountProvided }
      } = ctx.request.body

      const MIN_BALANCE_THRESHOLD = 5000
      const MIN_DEPOSIT_AMOUNT = 500
      const MAX_DEPOSIT_AMOUNT = 100000

      const reply = {}

      try {
        const user = await User.findOne({ where: { id: userID } })
        const connection = await Connection.findOne({
          where: { id: connectionID }
        })
        const account = await Account.findOne({ where: { id: accountID } })

        if (user && connection && account) {
          let accountBalance = account.getBalance()
          let amountToSave = 0
          let checkSafeBalance = false

          if (amountProvided) {
            amountToSave = amountProvided
          } else {
            if (user.savingType === 'Thrive Flex') {
              const { amount: amountFromAlgo } = await request.post({
                uri: `${config.constants.URL}/admin/algo-run`,
                body: {
                  secret: process.env.apiSecret,
                  data: {
                    userID: user.id,
                    connectionID: connection.id,
                    accountID: account.id
                  }
                },
                json: true
              })
              amountToSave = amountFromAlgo

              // Don't check the safe balance if lastGoodSync happened 3 days ago
              const daysFromLastGoodSync = moment().diff(
                moment(connection.lastGoodSync),
                'd'
              )
              checkSafeBalance = daysFromLastGoodSync > 3
            } else {
              amountToSave = user.fixedContribution
            }
          }

          if (amountToSave) {
            if (
              amountToSave >= MIN_DEPOSIT_AMOUNT &&
              amountToSave <= MAX_DEPOSIT_AMOUNT
            ) {
              if (!checkSafeBalance || accountBalance > MIN_BALANCE_THRESHOLD) {
                if (user.userType === 'vip') {
                  amplitude.track({
                    eventType: 'SAVER_REQUESTED_APPROVAL',
                    userId: user.id,
                    eventProperties: {
                      savingType: user.savingType,
                      amount: amountToSave
                    }
                  })
                  request.post({
                    uri: `${config.constants.URL}/slack-request-algo-approval`,
                    body: {
                      data: {
                        userID,
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
                        requestMethod: amountProvided
                          ? 'ThriveBot'
                          : 'Automated'
                      }
                    },
                    json: true
                  })
                }

                // Update the Next Save Date
                if (!amountProvided) {
                  user.setNextSaveDate()
                }
              } else {
                reply.error = true
                reply.errorCode = 'not_enough_balance'
                amplitude.track({
                  eventType: 'SAVER_PERFORM_FAIL',
                  userId: userID,
                  eventProperties: {
                    errorCode: reply.errorCode,
                    connectionID,
                    accountID,
                    amount: amountToSave,
                    accountBalance,
                    minBalanceThreshold: MIN_BALANCE_THRESHOLD
                  }
                })
              }
            } else {
              reply.error = true
              reply.errorCode = 'amount_out_of_range'
              amplitude.track({
                eventType: 'SAVER_PERFORM_FAIL',
                userId: userID,
                eventProperties: {
                  errorCode: reply.errorCode,
                  connectionID,
                  accountID,
                  amount: amountToSave,
                  accountBalance,
                  range: { min: MIN_DEPOSIT_AMOUNT, max: MAX_DEPOSIT_AMOUNT }
                }
              })
            }
          } else {
            reply.error = true
            reply.errorCode = 'no_amount_to_save'
            amplitude.track({
              eventType: 'SAVER_PERFORM_FAIL',
              userId: userID,
              eventProperties: {
                errorCode: reply.errorCode,
                connectionID,
                accountID,
                amount: amountToSave,
                accountBalance
              }
            })
          }
        } else {
          reply.error = true
          reply.errorCode = 'not_found'
          amplitude.track({
            eventType: 'SAVER_PERFORM_FAIL',
            userId: userID,
            eventProperties: {
              errorCode: reply.errorCode,
              connectionID,
              accountID
            }
          })
        }
      } catch (e) {
        reply.error = true
        reply.errorCode = 'try_catched'
        amplitude.track({
          eventType: 'SAVER_PERFORM_FAIL',
          userId: userID,
          eventProperties: {
            error: e,
            errorCode: reply.rerorCode
          }
        })
      }

      ctx.body = reply
    }
  }
})
