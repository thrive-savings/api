module.exports = (Bluebird, request, config) => ({
  link: {
    schema: [
      [
        'data',
        true,
        [
          ['username', true],
          ['passcode', true],
          ['institutionID', true, 'integer']
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { username, passcode, institutionID: quovoInstitutionID }
      } = ctx.request.body

      console.log({ username, passcode, quovoInstitutionID })
      const reply = {}

      // Get or Create Quovo user
      const {
        user: { id: userID, quovoUserID },
        error: quovoUserCreateError
      } = await request.post({
        uri: `${config.constants.URL}/admin/quovo-create-user`,
        body: {
          secret: process.env.apiSecret,
          data: {
            userID: ctx.authorized.id
          }
        },
        json: true
      })
      console.log({ userID, quovoUserID })

      if (quovoUserCreateError) {
        return Bluebird.reject([
          {
            key: 'QuovoUserCreate',
            value: 'Something went wrong when creating Quovo user.'
          }
        ])
      } else {
        // Create & Sync Quovo Connection
        const {
          connection: connectionData,
          error: quovoConnectionError
        } = await request.post({
          uri: `${config.constants.URL}/admin/quovo-create-connection`,
          body: {
            secret: process.env.apiSecret,
            data: {
              userID,
              quovoUserID,
              quovoInstitutionID,
              username,
              passcode
            }
          },
          json: true
        })

        console.log(connectionData)

        if (quovoConnectionError) {
          return Bluebird.reject([
            {
              key: 'QuovoConnectionCreate',
              value: 'Something went wrong when creating Quovo connection.'
            }
          ])
        } else {
          reply.connection = connectionData
        }
      }

      ctx.body = reply
    }
  },

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
        data: { userID, connectionID, institutionID }
      } = ctx.request.body

      console.log({ userID, connectionID, institutionID })

      ctx.body = {}
    }
  }
})
