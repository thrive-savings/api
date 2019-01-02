module.exports = (User, Connection, Account, Bluebird, request, config) => ({
  fetchAccounts: {
    schema: [
      [
        'data',
        true,
        [
          ['userID', true, 'integer'],
          ['connectionID', true, 'integer'],
          ['institutionID', true, 'integer']
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: {
          userID: quovoUserID,
          connectionID: quovoConnectionID,
          institutionID: quovoInstitutionID
        }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: ctx.authorized.id } })
      console.log({ quovoUserID, quovoConnectionID, quovoInstitutionID })

      const { error: quovoConnectionError } = await request.post({
        uri: `${config.constants.URL}/admin/quovo-get-connection`,
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

      const { error: quovoAccountError } = await request.post({
        uri: `${config.constants.URL}/admin/quovo-fetch-accounts-auth`,
        body: {
          secret: process.env.apiSecret,
          data: {
            quovoConnectionID
          }
        },
        json: true
      })

      if (quovoAccountError) {
        return Bluebird.reject([
          {
            key: 'QuovoFetchAccounts',
            value: `Something went wrong when fetching accounts for Quovo Connection [${quovoConnectionID}].`
          }
        ])
      }

      if (!user.bankLinked) {
        await user.update({ bankLinked: true })
      }

      const connectionInstance = await Connection.findOne({
        where: { quovoConnectionID },
        include: [Account]
      })
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
      const alreadyDefault = account.isDefault

      if (!alreadyDefault) {
        // Update Accounts
        await Account.update({ isDefault: false }, { where: { userID } })
        await account.update({ isDefault: true })
      }

      // Update Connections
      const connections = await Connection.findAll({
        include: [Account],
        where: { userID }
      })
      const connectionsData = []
      for (const connectionInstance of connections) {
        if (!alreadyDefault) {
          if (connectionInstance.id === account.connectionID) {
            connectionInstance.isDefault = true
          } else {
            connectionInstance.isDefault = false
          }
          await connectionInstance.save()
        }
        connectionsData.push(connectionInstance.getData())
      }

      ctx.body = { connections: connectionsData }
    }
  },

  unlinkConnection: {
    schema: [['data', true, [['connectionID', true, 'integer']]]],
    async method (ctx) {
      const {
        data: { connectionID }
      } = ctx.request.body

      const connection = await Connection.findOne({
        where: { id: connectionID }
      })
      if (!connection) {
        return Bluebird.reject([
          {
            key: 'Connection',
            value: `No connection found for id ${connectionID}`
          }
        ])
      }

      const quovoConnectionID = connection.quovoConnectionID
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

      await Connection.destroy({ where: { id: connectionID } })

      ctx.body = { connection: { id: connectionID, deleted: true } }
    }
  }
})
