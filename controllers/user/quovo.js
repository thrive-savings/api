module.exports = (request, config) => ({
  uiToken: {
    async method (ctx) {
      const {
        user: { quovoUserID },
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

      let uiToken
      if (!quovoUserCreateError) {
        await request.post({
          uri: `${config.constants.URL}/admin/quovo-api-token`,
          body: {
            secret: process.env.apiSecret
          },
          json: true
        })

        const {
          ui_token: { token }
        } = await request.post({
          uri: `${
            config.constants.QUOVO_API_URL
          }/users/${quovoUserID}/ui_token`,
          headers: { Authorization: `Bearer ${process.env.quovoApiToken}` },
          json: true
        })
        uiToken = token
      }

      ctx.body = { data: { token: uiToken } }
    }
  }
})
