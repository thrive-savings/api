module.exports = () => ({
  async before (ctx) {
    console.log(ctx.request)
  }
})
