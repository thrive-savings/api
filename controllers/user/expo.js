module.exports = User => ({
  token: {
    schema: [['data', true, [['token', true]]]],
    async method (ctx) {
      const {
        data: { token }
      } = ctx.request.body

      await User.update(
        { expoPushToken: token },
        { where: { id: ctx.authorized.id } }
      )

      ctx.body = {}
    }
  }
})
