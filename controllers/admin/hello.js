module.exports = () => ({
  async method (ctx, next) {
    ctx.body = { data: { response: 'Hello!' } }
  }
})
