module.exports = (request, config) => ({
  schema: [['data', true, [['test', true]]]],
  async method (ctx) {
    try {
      await request.post({
        uri: `${config.constants.URL}/test-error`,
        json: true
      })
    } catch (e) {
      console.log('Error catched from "test": ')
      console.log(e.error)
    }

    ctx.body = {}
  }
})
