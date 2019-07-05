module.exports = (
  User,
  Institution,
  Connection,
  Account,
  Bluebird,
  request,
  config
) => ({
  // Connection Level Endpoints

  fetchConnection: {
    schema: [['data', true, [['connectionID', true, 'integer']]]],
    async method (ctx) {
      ctx.request.socket.setTimeout(5 * 60 * 1000)

      const {
        data: { connectionID: quovoConnectionID }
      } = ctx.request.body

      const reply = {}

      const user = await User.findOne({ where: { id: ctx.authorized.id } })

      const {
        connection: { status },
        error: quovoConnectionError
      } = await request.post({
        uri: `${config.constants.URL}/admin/quovo-fetch-connection`,
        body: {
          secret: process.env.apiSecret,
          data: {
            userID: ctx.authorized.id,
            quovoConnectionID
          }
        },
        json: true
      })

      if (quovoConnectionError) {
        return Bluebird.reject([
          {
            key: 'QuovoGetConnection',
            value: `Something went wrong when fetching Quovo Connection [${quovoConnectionID}] data.`
          }
        ])
      }

      if (status === 'good') {
        const { error: quovoAuthError, countryCode } = await request.post({
          uri: `${config.constants.URL}/admin/quovo-fetch-connection-auth`,
          body: {
            secret: process.env.apiSecret,
            data: {
              quovoConnectionID
            }
          },
          json: true
        })

        if (quovoAuthError) {
          return Bluebird.reject([
            {
              key: 'QuovoFetchAccounts',
              value: `Something went wrong when fetching accounts for Quovo Connection [${quovoConnectionID}].`
            }
          ])
        }

        const { data: momentumOfferData } = await request.post({
          uri: `${config.constants.URL}/admin/momentum-create-offer`,
          body: {
            secret: process.env.apiSecret,
            data: {
              userID: user.id
            }
          },
          json: true
        })
        if (momentumOfferData) {
          reply.momentumOfferData = momentumOfferData
        }

        if (countryCode && countryCode === 'USA') {
          const { data: synapseEntryData } = await request.post({
            uri: `${config.constants.URL}/admin/synapse-create-user`,
            body: {
              secret: process.env.apiSecret,
              data: {
                userID: user.id
              }
            },
            json: true
          })
          if (synapseEntryData) {
            reply.synapseEntryData = synapseEntryData
          }
        }
      }

      if (!user.bankLinked) {
        await user.update({ bankLinked: true })
        await Connection.update(
          { isDefault: true },
          { where: { quovoConnectionID } }
        )
      }

      const connectionInstance = await Connection.findOne({
        where: { quovoConnectionID },
        include: [Institution, Account]
      })
      reply.connection = connectionInstance.getData()

      ctx.body = reply
    }
  },

  unlinkConnection: {
    schema: [
      ['data', true, [['connectionID', true], ['fromQuovo', 'boolean']]]
    ],
    async method (ctx) {
      const {
        data: { connectionID: quovoConnectionID, fromQuovo = true }
      } = ctx.request.body

      const connection = await Connection.findOne({
        where: { quovoConnectionID }
      })
      if (!connection) {
        return Bluebird.reject([
          {
            key: 'Connection',
            value: `No connection found for Quovo connectionID ${quovoConnectionID}`
          }
        ])
      }

      if (fromQuovo) {
        const { error: quovoConnectionError } = await request.post({
          uri: `${config.constants.URL}/admin/quovo-delete-connection`,
          body: {
            secret: process.env.apiSecret,
            data: {
              quovoConnectionID
            }
          },
          json: true
        })
        if (quovoConnectionError) {
          return Bluebird.reject([
            {
              key: 'QuovoGetConnection',
              value: `Something went wrong when deleting Quovo Connection [${quovoConnectionID}] data.`
            }
          ])
        }
      }

      const connectionID = connection.id
      await Connection.destroy({ where: { id: connectionID } })
      ctx.body = { connection: { id: connectionID, deleted: true }, fromQuovo }
    }
  },

  refreshConnection: {
    schema: [['data', true, [['connectionID', true]]]],
    async method (ctx) {
      const {
        data: { connectionID: quovoConnectionID }
      } = ctx.request.body

      const connection = await Connection.findOne({
        where: { quovoConnectionID }
      })
      if (!connection) {
        return Bluebird.reject([
          {
            key: 'Connection',
            value: `No connection found for Quovo connectionID ${quovoConnectionID}`
          }
        ])
      }

      const { error: quovoConnectionError } = await request.post({
        uri: `${config.constants.URL}/admin/quovo-fetch-connection-updates`,
        body: {
          secret: process.env.apiSecret,
          data: {
            quovoConnectionID: connection.quovoConnectionID
          }
        },
        json: true
      })
      if (quovoConnectionError) {
        return Bluebird.reject([
          {
            key: 'QuovoGetConnection',
            value: `Something went wrong when deleting Quovo Connection [${quovoConnectionID}] data.`
          }
        ])
      }

      ctx.body = { connection: {} }
    }
  },

  // Account Level Endpoints

  setDefaultAuthAccount: {
    schema: [['data', true, [['accountID', true, 'integer']]]],
    async method (ctx) {
      const {
        data: { accountID: quovoAccountID }
      } = ctx.request.body

      const account = await Account.findOne({ where: { quovoAccountID } })
      if (!account) {
        return Bluebird.reject([
          {
            key: 'Account',
            value: `No account found for Quovo AccountID ${quovoAccountID}`
          }
        ])
      }

      await Account.update(
        { isDefault: false },
        {
          where: {
            connectionID: account.connectionID,
            userID: ctx.authorized.id
          }
        }
      )
      await account.update({ isDefault: true })

      const connectionInstance = await Connection.findOne({
        where: { id: account.connectionID },
        include: [Institution, Account]
      })

      const defaultConnection = await Connection.findOne({
        where: { userID: connectionInstance.userID, isDefault: true }
      })
      if (!defaultConnection) {
        await connectionInstance.update({ isDefault: true })
      }

      ctx.body = { connection: connectionInstance.getData() }
    }
  },

  setDefaultAccount: {
    schema: [['data', true, [['accountID', true, 'integer']]]],
    async method (ctx) {
      const {
        data: { accountID }
      } = ctx.request.body

      const account = await Account.findOne({ where: { id: accountID } })
      if (!account) {
        return Bluebird.reject([
          { key: 'Account', value: `No account found for id ${accountID}` }
        ])
      }

      const userID = ctx.authorized.id

      if (!account.isDefault) {
        // Update Accounts
        await Account.update(
          { isDefault: false },
          { where: { userID, connectionID: account.connectionID } }
        )
        await account.update({ isDefault: true })
      }

      // Update Connections
      const connections = await Connection.findAll({
        include: [Institution, Account],
        where: { userID }
      })
      const connectionsData = []
      for (const connectionInstance of connections) {
        const newDefaultValue = connectionInstance.id === account.connectionID
        if (connectionInstance.isDefault !== newDefaultValue) {
          connectionInstance.isDefault = newDefaultValue
          await connectionInstance.save()
        }
        connectionsData.push(connectionInstance.getData())
      }

      ctx.body = { connections: connectionsData }
    }
  }
})
