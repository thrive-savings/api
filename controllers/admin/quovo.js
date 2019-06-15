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

      // Try deleting existing token
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
      } catch (e) {}

      // Try creating new token
      try {
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

        process.env['quovoApiToken'] = token
      } catch (e) {
        console.log(e)
        reply.error = true

        amplitude.track({
          eventType: 'QUOVO_GENERATE_TOKEN_FAIL',
          userId: 'server',
          eventProperties: {
            error: e
          }
        })
      }

      ctx.body = reply
    }
  },

  // Manual

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
              uri: `${config.constants.URL}/admin/quovo-fetch-connection`,
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
              uri: `${config.constants.URL}/admin/quovo-fetch-connection-auth`,
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

  // Bank Linking

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
              error: e
            }
          })
        }
      }

      ctx.body = reply
    }
  },

  fetchConnection: {
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
        reply.connection = connectionData

        amplitude.track({
          eventType: 'QUOVO_FETCH_CONNECTION_SUCCEED',
          userId: userID,
          eventProperties: connectionData
        })
      } catch (e) {
        amplitude.track({
          eventType: 'QUOVO_FETCH_CONNECTION_FAIL',
          userId: userID,
          eventProperties: {
            quovoConnectionID,
            error: e
          }
        })
        reply.error = true
      }

      ctx.body = reply
    }
  },

  fetchConnectionAuth: {
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
          auth: {
            last_good_auth: lastGoodAuth,
            country_code: countryCode,
            accounts
          }
        } = await request.get({
          uri: `${
            config.constants.QUOVO_API_URL
          }/connections/${quovoConnectionID}/auth`,
          headers: {
            Authorization: `Bearer ${process.env.quovoApiToken}`
          },
          json: true
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
            wire_routing: wireRoutingNumber,
            category,
            type,
            type_confidence: typeConfidence,
            owner_details: ownerDetails
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
              wireRouting: wireRoutingNumber,
              availableBalance: parseInt(availableBalanceInFloat * 100),
              presentBalance: parseInt(presentBalanceInFloat * 100),
              ownerDetails
            }

            if (type === 'Credit Card') {
              // If type loan, fetch extras
              const { extras } = await request.get({
                uri: `${
                  config.constants.QUOVO_API_URL
                }/accounts/${quovoAccountID}/extras`,
                headers: {
                  Authorization: `Bearer ${process.env.quovoApiToken}`
                },
                json: true
              })
              if (extras && typeof extras === 'object') {
                accountData.extras = extras
              }
            }

            if (!accountInstance) {
              accountInstance = await Account.create(accountData)
            } else {
              accountInstance.update(accountData)
            }

            if (type === 'Credit Card') {
              // Call Debt creator
              await request.post({
                uri: `${config.constants.URL}/admin/debt-create`,
                body: {
                  secret: process.env.apiSecret,
                  data: {
                    accountID: accountInstance.id
                  }
                },
                json: true
              })
            }
          }

          connection.lastGoodAuth = lastGoodAuth
          connection.countryCode = countryCode
          connection.save()
          amplitude.track({
            eventType: 'QUOVO_CONNECTION_AUTH_SUCCEED',
            userId: connection.userID,
            eventProperties: {
              accountsCount: accounts ? accounts.length : 0
            }
          })
        } else {
          amplitude.track({
            eventType: 'QUOVO_CONNECTION_AUTH_NO_ACCOUNTS',
            userId: connection.userID
          })
        }
      } catch (e) {
        reply.error = true
        amplitude.track({
          eventType: 'QUOVO_CONNECTION_AUTH_FAIL',
          userId: connection.userID,
          eventProperties: {
            error: e
          }
        })
      }

      ctx.body = {}
    }
  },

  fetchAccountAuth: {
    async method (ctx) {
      const {
        data: { quovoAccountID }
      } = ctx.request.body

      const account = await Account.findOne({
        include: [Connection],
        where: { quovoAccountID }
      })

      const reply = {}
      try {
        const {
          auth: {
            last_good_auth: lastGoodAuth,
            available_balance: availableBalanceInFloat,
            present_balance: presentBalanceInFloat,
            account_name: accountName,
            account_nickname: accountNickname,
            account_number: accountNumber,
            canadian_institution_number: institutionNumber,
            transit_number: transitNumber,
            routing: routingNumber,
            wire_routing: wireRoutingNumber,
            category,
            type,
            type_confidence: typeConfidence,
            owner_details: ownerDetails
          }
        } = await request.get({
          uri: `${
            config.constants.QUOVO_API_URL
          }/accounts/${quovoAccountID}/auth`,
          headers: {
            Authorization: `Bearer ${process.env.quovoApiToken}`
          },
          json: true
        })

        account.update({
          category,
          type,
          typeConfidence,
          name: accountName,
          nickname: accountNickname,
          institution: institutionNumber,
          transit: transitNumber,
          number: accountNumber,
          routing: routingNumber,
          wireRouting: wireRoutingNumber,
          availableBalance: parseInt(availableBalanceInFloat * 100),
          presentBalance: parseInt(presentBalanceInFloat * 100),
          ownerDetails
        })

        account.connection.update({ lastGoodAuth })

        amplitude.track({
          eventType: 'QUOVO_ACCOUNT_AUTH_SUCCEED',
          userId: account.userID,
          eventProperties: {
            accountID: account.id
          }
        })
      } catch (e) {
        reply.error = true
        amplitude.track({
          eventType: 'QUOVO_ACCOUNT_AUTH_FAIL',
          userId: account.userID,
          eventProperties: {
            error: e
          }
        })
      }

      ctx.body = reply
    }
  },

  deleteConnection: {
    async method (ctx) {
      const {
        data: { quovoConnectionID }
      } = ctx.request.body

      const connection = await Connection.findOne({
        where: { quovoConnectionID }
      })

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

        amplitude.track({
          eventType: 'QUOVO_DELETE_CONNECTION_SUCCEED',
          userId: connection.userID,
          eventProperties: {
            quovoConnectionID,
            institutionName: connection.institutionName
          }
        })
      } catch (e) {
        reply.error = true
        amplitude.track({
          eventType: 'QUOVO_DELETE_CONNECTION_FAIL',
          userId: connection.userID,
          eventProperties: {
            error: e
          }
        })
      }

      ctx.body = reply
    }
  },

  // Update Fetchers

  fetchUpdates: {
    async method (ctx) {
      const users = await User.findAll({
        where: { quovoUserID: { [Sequelize.Op.ne]: null }, isActive: true }
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

  fetchUserUpdates: {
    async method (ctx) {
      const {
        data: { quovoUserID }
      } = ctx.request.body

      const user = await User.findOne({ where: { quovoUserID } })
      const reply = {}

      try {
        const connections = await Connection.findAll({
          where: {
            userID: user.id,
            [Sequelize.Op.or]: [
              { status: 'good' },
              { status: 'maintenance' },
              { status: 'postponed' },
              { status: null }
            ]
          }
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
                    quovoConnectionID: connection.quovoConnectionID
                  }
                },
                json: true
              })
            )
          )

          amplitude.track({
            eventType: 'QUOVO_FETCH_USER_UPDATES_PASS',
            userId: user.id,
            eventProperties: {
              connectionCount: connections ? connections.length : 0
            }
          })
        } else {
          amplitude.track({
            eventType: 'QUOVO_FETCH_USER_UPDATES_NO_ACTION',
            userId: user.id,
            eventProperties: {
              error: 'No connections found with status "good" or "loading".'
            }
          })
        }
      } catch (e) {
        reply.error = true

        amplitude.track({
          eventType: 'QUOVO_FETCH_USER_UPDATES_FAIL',
          userId: user.id,
          eventProperties: {
            error: e
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

        const oldStatus = connection.status
        await connection.update({
          lastGoodSync,
          lastSync,
          status,
          statusDetails,
          value
        })

        amplitude.track({
          eventType: 'QUOVO_FETCH_CONNECTION_UPDATES_SUCCEED',
          userId: connection.userID,
          eventProperties: {
            connectionID: connection.id,
            quovoConnectionID,
            value,
            status
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
              }] status changed from *${oldStatus}* to *${status}*`
            },
            json: true
          })

          amplitude.track({
            eventType: 'QUOVO_CONNECTION_DISCONNECTED',
            userId: connection.userID,
            eventProperties: {
              institutionName: connection.institutionName,
              connectionID: connection.id,
              quovoConnectionID: connection.quovoConnectionID,
              quovoUserID: connection.quovoUserID,
              status
            }
          })
        }

        if (
          !connection.lastGoodAuth ||
          moment().diff(moment(connection.lastGoodAuth), 'd') > 7
        ) {
          request.post({
            uri: `${config.constants.URL}/admin/quovo-fetch-connection-auth`,
            body: {
              secret: process.env.apiSecret,
              data: {
                quovoConnectionID
              }
            },
            json: true
          })
        }
      } catch (e) {
        reply.error = true

        amplitude.track({
          eventType: 'QUOVO_FETCH_CONNECTION_UPDATES_FAIL',
          userId: connection.userID,
          eventProperties: {
            connectionID: connection.id,
            quovoConnectionID: connection.quovoConnectionID,
            quovoUserID: connection.quovoUserID,
            institutionName: connection.institutionName,
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

        if (accounts && accounts.length > 0) {
          Bluebird.all(
            accounts.map(
              ({
                id: quovoAccountID,
                value: accountValue,
                owner_type: ownerType
              }) => {
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
                  { value: parseInt(accountValue * 100), ownerType },
                  { where: { quovoAccountID } }
                )
              }
            )
          )
        }

        amplitude.track({
          eventType: 'QUOVO_FETCH_ACCOUNTS_UPDATES_SUCCEED',
          userId: connection.userID,
          eventProperties: {
            connectionID: connection.id,
            quovoConnectionID,
            accountsCount: accounts ? accounts.length : 0
          }
        })
      } catch (e) {
        reply.error = true

        amplitude.track({
          eventType: 'QUOVO_FETCH_ACCOUNTS_UPDATES_FAIL',
          userId: connection.userID,
          eventProperties: {
            connectionID: connection.id,
            quovoConnectionID: connection.quovoConnectionID,
            quovoUserID: connection.quovoUserID,
            error: e
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
        if (!account.hasACH() || !account.getOwnerAddress()) {
          request.post({
            uri: `${config.constants.URL}/admin/quovo-fetch-account-auth`,
            body: {
              secret: process.env.apiSecret,
              data: {
                quovoAccountID
              }
            },
            json: true
          })
        }

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

        amplitude.track({
          eventType: 'QUOVO_FETCH_ACCOUNT_TRANSACTIONS_SUCCEED',
          userId: account.userID,
          eventProperties: {
            transactionsCount: transactions ? transactions.length : 0,
            accountID: account.id,
            quovoAccountID: account.quovoAccountID,
            quovoConnectionID: account.quovoConnectionID,
            quovoUserID: account.quovoUserID
          }
        })
      } catch (e) {
        reply.error = true

        amplitude.track({
          eventType: 'QUOVO_FETCH_ACCOUNT_TRANSACTIONS_FAIL',
          userId: account.userID,
          eventProperties: {
            accountID: account.id,
            quovoAccountID: account.quovoAccountID,
            quovoConnectionID: account.quovoConnectionID,
            quovoUserID: account.quovoUserID,
            error: e
          }
        })
      }

      ctx.body = reply
    }
  }
})
