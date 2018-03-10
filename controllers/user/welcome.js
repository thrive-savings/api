module.exports = (Goal, User) => ({
  async method (ctx) {
    await User.update({ isWelcomed: true }, { where: { id: ctx.authorized.id } })

    ctx.body = { data: { authorized: { isWelcomed: true } } }
  }
})
