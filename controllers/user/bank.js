module.exports = (User, Connection, Account, request, config) => ({
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
        data: { username, passcode, institutionID }
      } = ctx.request.body

      console.log({ username, passcode, institutionID })
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
      reply.error = quovoUserCreateError

      if (!reply.error) {
        // Create & Sync Quovo Connection
        const {
          connection: { id: connectionID, quovoConnectionID, sync: syncData },
          error: quovoConnectionError
        } = await request.post({
          uri: `${config.constants.URL}/admin/quovo-create-connection`,
          body: {
            secret: process.env.apiSecret,
            data: {
              userID,
              quovoUserID,
              quovoInstitutionID: institutionID,
              username,
              passcode
            }
          },
          json: true
        })

        console.log({ connectionID, quovoConnectionID, sync: syncData })
        reply.error = quovoConnectionError
        if (!reply.error) {
          reply.connection = { connectionID, quovoConnectionID, sync: syncData }
        }
      }

      ctx.body = reply
    }
  }
})
