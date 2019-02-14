module.exports = (request, config) => ({
  fetch: {
    schema: [['data', true, [['fromDate', true]]]],
    async method (ctx) {
      const {
        data: { fromDate }
      } = ctx.request.body

      const { history, totalSavings } = await request.post({
        uri: `${config.constants.URL}/admin/history-fetch`,
        body: {
          secret: process.env.apiSecret,
          data: {
            userID: ctx.authorized.id,
            fromDate
          }
        },
        json: true
      })

      ctx.body = { data: { chart: [], history, totalSavings } }
    }
  }
})
