module.exports = () => ({
  async method (ctx, next) {
    ctx.body = { data: { response: 'Hello!' } }
  },
  onError (ctx) {
    console.log('In onError')
    // let { Error } = ctx.status
    console.log(ctx.status)
    console.log('after logging error')
    // if (code) return [{ key: 'code', value: code }]
  }
})
