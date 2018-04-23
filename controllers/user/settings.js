module.exports = (User) => ({
  setPhone: {
    schema: [['data', true, [['phone', true]]]],
    async method (ctx) {
      const { data: { phone } } = ctx.request.body

      await User.update({ phone }, { where: { id: ctx.authorized.id } })

      const user = await User.findOne({ where: { id: ctx.authorized.id } })
      await user.sendCode()

      ctx.body = { data: { phone } }
    }
  }
})
