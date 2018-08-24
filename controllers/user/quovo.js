module.exports = request => ({
  uiToken: {
    async method (ctx) {
      // TODO: Get Quovo User ID for real User
      const {
        ui_token: { token }
      } = await request.post({
        uri: `${process.env.quovoApiURL}/users/5271443/ui_token`,
        headers: { Authorization: `Bearer ${process.env.quovoApiToken}` },
        json: true
      })

      ctx.body = { data: { token } }
    }
  }
})
