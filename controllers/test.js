module.exports = User => ({
  async method (ctx) {
    const {
      data: { userID }
    } = ctx.request.body

    const user = await User.findOne({ where: { id: userID } })
    const daysLeft = user.daysLeftToNextPull()

    ctx.body = { data: { daysLeft } }
  }
})
