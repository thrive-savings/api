module.exports = () => ({
  async method (ctx, next) {
    ctx.body = 'Hello!'
  }
})
