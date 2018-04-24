module.exports = (Bluebird, User) => ({
  setPhone: {
    schema: [['data', true, [['phone', true]]]],
    async method (ctx) {
      const { data: { phone } } = ctx.request.body

      let user = await User.findOne({ where: { phone } })

      if (user) {
        return Bluebird.reject([{ key: 'phone', value: 'This phone already exists in our system. Please use another one.' }])
      }

      await User.update({ phone, isVerified: 0 }, { where: { id: ctx.authorized.id } })

      user = await User.findOne({ where: { id: ctx.authorized.id } })
      await user.sendCode()

      ctx.body = { data: { authorized: user.getAuthorized() } }
    }
  },
  setEmail: {
    schema: [['data', true, [['email', true]]]],
    async method (ctx) {
      const { data: { email } } = ctx.request.body

      let user = await User.findOne({ where: { email } })

      if (user) {
        return Bluebird.reject([{ key: 'email', value: 'This email already exists in our system. Please use another one.' }])
      }

      await User.update({ email }, { where: { id: ctx.authorized.id } })

      user = await User.findOne({ where: { id: ctx.authorized.id } })
      ctx.body = { data: { authorized: user.getAuthorized() } }
    }
  },
  setPassword: {
    schema: [['data', true, [['password', true], ['newPassword', true]]]],
    async method (ctx) {
      const { data: { password, newPassword } } = ctx.request.body

      const user = await User.findOne({ where: { id: ctx.authorized.id } })

      if (!user.checkPassword(password)) {
        return Bluebird.reject([{ key: 'password', value: 'Your original password is incorrect. Please try again or contact support.' }])
      }

      user.hashPassword(newPassword)
      await user.save()

      ctx.body = { data: { authorized: user.getAuthorized() } }
    }
  }
})
