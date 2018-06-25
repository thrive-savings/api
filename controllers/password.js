module.exports = (Bluebird, moment, User) => ({
  request: {
    schema: [['data', true, [['email', true]]]],
    async method (ctx) {
      const { data: { email } } = ctx.request.body
      const user = await User.findOne({ where: { email } })
      if (!user) {
        return Bluebird.reject([{ key: 'email', value: 'There is no user with such email. Please, try another or sign up.' }])
      }
      await user.generateRestorePasswordToken()
      ctx.body = {}
    }
  },
  reset: {
    schema: [['data', true, [['password', true], ['token', true]]]],
    async method (ctx) {
      const { data: { password, token } } = ctx.request.body
      const user = await User.findOne({ where: { restorePasswordToken: token } })
      if (!user || moment() > moment(user.restorePasswordTokenExpiresAt)) {
        return Bluebird.reject([{ key: 'password', value: `Password can't be changed. Please, try again` }])
      }
      user.hashPassword(password)
      user.restorePasswordToken = null
      user.restorePasswordTokenExpiresAt = null
      await user.save()
      ctx.body = {}
    }
  },
  requestMobile: {
    schema: [['data', true, [['email', true]]]],
    async method (ctx) {
      const { data: { email: providedEmail } } = ctx.request.body
      const email = providedEmail.toLowerCase()

      const user = await User.findOne({ where: { email } })
      if (!user) {
        return Bluebird.reject([{ key: 'email', value: 'There is no user with such email. Please, try another or sign up.' }])
      }
      await user.generateRestorePasswordCode()
      ctx.body = {}
    }
  },
  resetMobile: {
    schema: [['data', true, [['password', true], ['code', true]]]],
    async method (ctx) {
      const { data: { password, code } } = ctx.request.body
      const user = await User.findOne({ where: { restorePasswordToken: code } })
      if (!user || moment() > moment(user.restorePasswordTokenExpiresAt)) {
        return Bluebird.reject([{ key: 'password', value: `Password can't be changed. Please, try again` }])
      }
      user.hashPassword(password)
      user.restorePasswordToken = null
      user.restorePasswordTokenExpiresAt = null
      await user.save()
      ctx.body = {}
    }
  }
})
