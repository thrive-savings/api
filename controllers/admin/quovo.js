module.exports = (
  Sequelize,
  Bluebird,
  Institution,
  User,
  Connection,
  Account,
  Transaction,
  request,
  config,
  amplitude,
  moment
) => ({
  apiToken: {
    async method (ctx) {
      const reply = {}

      try {
        await request.delete({
          uri: `${config.constants.QUOVO_API_URL}/tokens`,
          auth: {
            user: process.env.quovoApiUsername,
            pass: process.env.quovoApiPassword
          },
          body: {
            name: process.env.quovoApiTokenName
          },
          json: true
        })

        const {
          access_token: { token }
        } = await request.post({
          uri: `${config.constants.QUOVO_API_URL}/tokens`,
          auth: {
            user: process.env.quovoApiUsername,
            pass: process.env.quovoApiPassword
          },
          body: {
            name: process.env.quovoApiTokenName,
            expires: moment().add(1, 'd')
          },
          json: true
        })
        console.log(token)

        process.env['quovoApiToken'] = token
      } catch (e) {
        console.log(e)
        reply.error = true

        amplitude.track({
          eventType: 'QUOVO_GENERATE_TOKEN_FAIL',
          userId: 'server',
          eventProperties: {
            Error: e
          }
        })
      }

      ctx.body = reply
    }
  },

  syncInstitutions: {
    async method (ctx) {
      try {
        await request.post({
          uri: `${config.constants.URL}/admin/quovo-api-token`,
          body: {
            secret: process.env.apiSecret
          },
          json: true
        })

        const { institutions } = await request.get({
          uri: `${config.constants.QUOVO_API_URL}/institutions`,
          headers: {
            Authorization: `Bearer ${process.env.quovoApiToken}`
          },
          json: true
        })

        for (const {
          id: quovoInstitutionID,
          name,
          website,
          details,
          access_info: accessInfo,
          is_test: isTest,
          is_available: isAvailable,
          country_code: countryCode
        } of institutions) {
          if (countryCode !== 'CAN') {
            continue
          }

          const obj = {
            quovoInstitutionID,
            name,
            website,
            details,
            accessInfo,
            isTest,
            isAvailable,
            countryCode
          }

          const institutionInstance = await Institution.findOne({
            where: { quovoInstitutionID }
          })

          if (!institutionInstance) {
            await Institution.create(obj)
          } else {
            await institutionInstance.update(obj)
          }
        }
      } catch (e) {
        console.log(e)
      }

      ctx.body = {}
    }
  },

  syncConnections: {
    schema: [['data', [['quovoUserIDs', 'array']]]],
    async method (ctx) {
      const { data: { quovoUserIDs } = {} } = ctx.request.body

      try {
        await request.post({
          uri: `${config.constants.URL}/admin/quovo-api-token`,
          body: {
            secret: process.env.apiSecret
          },
          json: true
        })

        const where = {}
        if (quovoUserIDs && quovoUserIDs.length > 0) {
          where.quovoUserID = { [Sequelize.Op.in]: quovoUserIDs }
        } else {
          where.quovoUserID = { [Sequelize.Op.ne]: null }
        }
        const users = await User.findAll({ where })

        users.forEach(async ({ id: userID, quovoUserID }) => {
          const { connections } = await request.get({
            uri: `${
              config.constants.QUOVO_API_URL
            }/users/${quovoUserID}/connections`,
            headers: {
              Authorization: `Bearer ${process.env.quovoApiToken}`
            },
            json: true
          })

          connections.forEach(async ({ id: quovoConnectionID }) => {
            await request.post({
              uri: `${config.constants.URL}/admin/quovo-get-connection`,
              body: {
                secret: process.env.apiSecret,
                data: {
                  userID,
                  quovoConnectionID
                }
              },
              json: true
            })

            await request.post({
              uri: `${config.constants.URL}/admin/quovo-fetch-accounts-auth`,
              body: {
                secret: process.env.apiSecret,
                data: {
                  quovoConnectionID
                }
              },
              json: true
            })
          })
        })
      } catch (e) {
        console.log(e)
      }

      ctx.body = {}
    }
  },

  createUser: {
    schema: [['data', true, [['userID', true, 'integer']]]],
    async method (ctx) {
      const {
        data: { userID }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: userID } })
      const reply = {
        user: {
          id: user.id,
          quovoUserID: user.quovoUserID,
          quovoUserName: user.quovoUserName
        }
      }

      if (!user.quovoUserID) {
        const quovoUserName = `THRIVE${
          process.env.NODE_ENV !== 'production' ? '_DEV' : ''
        }_${userID}`

        try {
          const {
            user: { id: quovoUserID }
          } = await request.post({
            uri: `${config.constants.QUOVO_API_URL}/users`,
            headers: {
              Authorization: `Bearer ${process.env.quovoApiToken}`
            },
            body: {
              username: quovoUserName,
              email: user.email,
              name: `${user.firstName} ${user.lastName}`
            },
            json: true
          })

          user.quovoUserID = quovoUserID
          user.quovoUserName = quovoUserName
          await user.save()

          amplitude.track({
            eventType: 'QUOVO_USER_CREATED',
            userId: user.id,
            userProperties: {
              QuovoUserID: quovoUserID,
              QuovoUserName: quovoUserName
            }
          })

          reply.user.quovoUserID = quovoUserID
        } catch (e) {
          console.log(e)

          amplitude.track({
            eventType: 'QUOVO_USER_CREATE_FAIL',
            userId: user.id,
            eventProperties: {
              Error: e
            }
          })
        }
      }

      ctx.body = reply
    }
  },

  getConnection: {
    async method (ctx) {
      const {
        data: { userID, quovoConnectionID }
      } = ctx.request.body

      const reply = {}
      try {
        let connectionInstance = await Connection.findOne({
          where: { quovoConnectionID }
        })

        const {
          connection: {
            user_id: quovoUserID,
            institution_name: institutionName,
            institution_id: quovoInstitutionID,
            last_good_sync: lastGoodSync,
            last_sync: lastSync,
            config_instructions: statusDetails,
            status,
            value: floatValue
          }
        } = await request.get({
          uri: `${
            config.constants.QUOVO_API_URL
          }/connections/${quovoConnectionID}`,
          headers: {
            Authorization: `Bearer ${process.env.quovoApiToken}`
          },
          json: true
        })

        const institutionInstance = await Institution.findOne({
          where: { quovoInstitutionID }
        })

        const connectionData = {
          userID,
          status,
          statusDetails,
          value: parseInt(floatValue * 100),
          lastGoodSync,
          lastSync,
          institutionName,
          quovoConnectionID,
          quovoInstitutionID,
          quovoUserID,
          institutionID: institutionInstance ? institutionInstance.id : 1
        }
        if (!connectionInstance) {
          connectionInstance = await Connection.create(connectionData)
        } else {
          await connectionInstance.update(connectionData)
        }
      } catch (e) {
        console.log(e)
        reply.error = true
      }

      ctx.body = reply
    }
  },

  fetchAccountsAuth: {
    async method (ctx) {
      const {
        data: { quovoConnectionID }
      } = ctx.request.body

      const connection = await Connection.findOne({
        where: { quovoConnectionID }
      })

      const reply = {}
      try {
        const {
          auth: { accounts }
        } = await request.get({
          uri: `${
            config.constants.QUOVO_API_URL
          }/connections/${quovoConnectionID}/auth`,
          headers: {
            Authorization: `Bearer ${process.env.quovoApiToken}`
          },
          json: true
        })

        amplitude.track({
          eventType: 'FETCHED_ACCOUNTS_AUTH',
          userId: connection.userID,
          eventProperties: {
            AccountsCount: accounts ? accounts.length : 0
          }
        })

        if (accounts && accounts.length > 0) {
          for (const {
            id: quovoAccountID,
            available_balance: availableBalanceInFloat,
            present_balance: presentBalanceInFloat,
            account_name: accountName,
            account_nickname: accountNickname,
            account_number: accountNumber,
            canadian_institution_number: institutionNumber,
            transit_number: transitNumber,
            routing: routingNumber,
            category,
            type,
            type_confidence: typeConfidence
          } of accounts) {
            let accountInstance = await Account.findOne({
              where: { quovoAccountID }
            })
            const accountData = {
              quovoAccountID,
              quovoConnectionID,
              quovoUserID: connection.quovoUserID,
              connectionID: connection.id,
              userID: connection.userID,
              category,
              type,
              typeConfidence,
              name: accountName,
              nickname: accountNickname,
              institution: institutionNumber,
              transit: transitNumber,
              number: accountNumber,
              routing: routingNumber,
              availableBalance: parseInt(availableBalanceInFloat * 100),
              presentBalance: parseInt(presentBalanceInFloat * 100)
            }

            if (!accountInstance) {
              accountInstance = await Account.create(accountData)
            } else {
              accountInstance.update(accountData)
            }
          }
        }
      } catch (e) {
        reply.error = true

        amplitude.track({
          eventType: 'FETCH_ACCOUNTS_AUTH_FAIL',
          userId: connection.userID,
          eventProperties: {
            Error: e
          }
        })
      }

      ctx.body = {}
    }
  },

  deleteConnection: {
    async method (ctx) {
      const {
        data: { quovoConnectionID }
      } = ctx.request.body

      const reply = {}
      try {
        await request.post({
          uri: `${config.constants.URL}/admin/quovo-api-token`,
          body: {
            secret: process.env.apiSecret
          },
          json: true
        })

        await request.delete({
          uri: `${
            config.constants.QUOVO_API_URL
          }/connections/${quovoConnectionID}`,
          headers: {
            Authorization: `Bearer ${process.env.quovoApiToken}`
          },
          json: true
        })
      } catch (e) {
        console.log(e)
        reply.error = true
      }

      ctx.body = reply
    }
  },

  fetchUserUpdates: {
    async method (ctx) {
      const {
        data: { quovoUserID }
      } = ctx.request.body

      const user = await User.findOne({ where: { quovoUserID } })
      const reply = {}

      try {
        const connections = await Connection.findAll({
          where: { status: 'good', userID: user.id }
        })

        if (connections && connections.length > 0) {
          Bluebird.all(
            connections.map(connection =>
              request.post({
                uri: `${
                  config.constants.URL
                }/admin/quovo-fetch-connection-updates`,
                body: {
                  secret: process.env.apiSecret,
                  data: {
                    userID: user.id,
                    quovoConnectionID: connection.quovoConnectionID
                  }
                },
                json: true
              })
            )
          )
        }

        amplitude.track({
          eventType: 'FETCHING_USER_UPDATES',
          userId: user.id,
          eventProperties: {
            ConnectionCount: connections ? connections.length : 0
          }
        })
      } catch (e) {
        reply.error = true

        amplitude.track({
          eventType: 'FETCH_USER_UPDATES_FAIL',
          userId: user.id,
          eventProperties: {
            Error: e
          }
        })
      }

      ctx.body = reply
    }
  },

  fetchConnectionUpdates: {
    async method (ctx) {
      const {
        data: { quovoConnectionID }
      } = ctx.request.body

      const connection = await Connection.findOne({
        where: { quovoConnectionID }
      })

      const reply = {}
      try {
        const {
          connection: {
            last_good_sync: lastGoodSync,
            last_sync: lastSync,
            config_instructions: statusDetails,
            status,
            value: floatValue
          }
        } = await request.get({
          uri: `${
            config.constants.QUOVO_API_URL
          }/connections/${quovoConnectionID}`,
          headers: {
            Authorization: `Bearer ${process.env.quovoApiToken}`
          },
          json: true
        })
        const value = parseInt(floatValue * 100)

        await connection.update({
          lastGoodSync,
          lastSync,
          status,
          statusDetails,
          value
        })

        amplitude.track({
          eventType: 'FETCHED_CONNECTION_UPDATES',
          userId: connection.userID,
          eventProperties: {
            ConnectionID: connection.id,
            QuovoConnectionID: quovoConnectionID,
            Value: value,
            Status: status
          }
        })

        if (status === 'good') {
          request.post({
            uri: `${config.constants.URL}/admin/quovo-fetch-accounts-updates`,
            body: {
              secret: process.env.apiSecret,
              data: {
                quovoConnectionID
              }
            },
            json: true
          })
        } else {
          // TODO: Schedule notifications about unlink
          await request.post({
            uri: process.env.slackWebhookURL,
            body: {
              text: `User [${connection.userID}] | Connection [${
                connection.id
              }] got disconnected`
            },
            json: true
          })
        }
      } catch (e) {
        reply.error = true

        amplitude.track({
          eventType: 'FETCH_CONNECTION_UPDATES_FAIL',
          userId: connection.userID,
          eventProperties: {
            ConnectionID: connection.id,
            QuovoConnectionID: connection.quovoConnectionID,
            QuovoUserID: connection.quovoUserID,
            Error: e
          }
        })
      }

      ctx.body = reply
    }
  },

  fetchAccountsUpdates: {
    async method (ctx) {
      const {
        data: { quovoConnectionID }
      } = ctx.request.body

      const connection = await Connection.findOne({
        where: { quovoConnectionID }
      })

      const reply = {}
      try {
        const { accounts } = await request.get({
          uri: `${
            config.constants.QUOVO_API_URL
          }/connections/${quovoConnectionID}/accounts`,
          headers: {
            Authorization: `Bearer ${process.env.quovoApiToken}`
          },
          json: true
        })

        amplitude.track({
          eventType: 'FETCHED_ACCOUNTS_UPDATES',
          userId: connection.userID,
          eventProperties: {
            ConnectionID: connection.id,
            QuovoConnectionID: quovoConnectionID,
            AccountsCount: accounts ? accounts.length : 0
          }
        })

        if (accounts && accounts.length > 0) {
          Bluebird.all(
            accounts.map(({ id: quovoAccountID, value: accountValue }) => {
              request.post({
                uri: `${
                  config.constants.URL
                }/admin/quovo-fetch-account-transactions`,
                body: {
                  secret: process.env.apiSecret,
                  data: {
                    quovoAccountID
                  }
                },
                json: true
              })
              return Account.update(
                { value: parseInt(accountValue * 100) },
                { where: { quovoAccountID } }
              )
            })
          )
        }
      } catch (e) {
        reply.error = true

        amplitude.track({
          eventType: 'FETCH_ACCOUNTS_UPDATES_FAIL',
          userId: connection.userID,
          eventProperties: {
            ConnectionID: connection.id,
            QuovoConnectionID: connection.quovoConnectionID,
            QuovoUserID: connection.quovoUserID,
            Error: e
          }
        })
      }

      ctx.body = reply
    }
  },

  fetchAccountTransactions: {
    async method (ctx) {
      const {
        data: { quovoAccountID }
      } = ctx.request.body

      const account = await Account.findOne({
        where: { quovoAccountID }
      })

      const reply = {}
      try {
        const lastTransactionSaved = await Transaction.findOne({
          order: [['date', 'DESC']],
          where: { quovoAccountID }
        })

        const { transactions } = await request.get({
          uri: `${
            config.constants.QUOVO_API_URL
          }/accounts/${quovoAccountID}/transactions${
            lastTransactionSaved
              ? `?start_id=${lastTransactionSaved.quovoTransactionID}`
              : ''
          }`,
          headers: {
            Authorization: `Bearer ${process.env.quovoApiToken}`
          },
          json: true
        })

        amplitude.track({
          eventType: 'FETCHED_NEW_ACCOUNT_TRANSACTIONS',
          userId: account.userID,
          eventProperties: {
            TransactionsCount: transactions ? transactions.length : 0,
            AccountID: account.id,
            QuovoAccountID: account.quovoAccountID,
            QuovoConnectionID: account.quovoConnectionID,
            QuovoUserID: account.quovoUserID
          }
        })

        if (transactions && transactions.length > 0) {
          Bluebird.all(
            transactions.map(
              ({
                id: quovoTransactionID,
                account_id: quovoAccountID,
                connection_id: quovoConnectionID,
                user_id: quovoUserID,
                memo,
                cashflow_category: category,
                cashflow_subcategory: subcategory,
                type,
                subtype,
                value: floatValue,
                fees: floatFees,
                is_cancel: isCancel,
                is_pending: isPending,
                date
              }) =>
                Transaction.findOrCreate({
                  where: { quovoTransactionID },
                  defaults: {
                    quovoTransactionID,
                    quovoAccountID,
                    quovoConnectionID,
                    quovoUserID,
                    accountID: account.id,
                    description: memo,
                    category,
                    subcategory,
                    type,
                    subtype,
                    transactionType: floatValue < 0 ? 'debit' : 'credit',
                    value: parseInt(floatValue * 100),
                    fees: parseInt(floatFees * 100),
                    isCancel,
                    isPending,
                    date
                  }
                })
            )
          )
        }
      } catch (e) {
        reply.error = true

        amplitude.track({
          eventType: 'FETCH_ACCOUNT_TRANSACTIONS_FAIL',
          userId: account.userID,
          eventProperties: {
            AccountID: account.id,
            QuovoAccountID: account.quovoAccountID,
            QuovoConnectionID: account.quovoConnectionID,
            QuovoUserID: account.quovoUserID,
            Error: e
          }
        })
      }

      ctx.body = reply
    }
  }
})
