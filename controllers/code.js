module.exports = (Bluebird, User, Company) => ({
  resend: {
    schema: [['data', true, [['email', true], ['phone', true]]]],
    async method (ctx) {
      const { data: { email, phone } } = ctx.request.body
      const user = await User.findOne({ where: { email, phone } })

      if (!user) return Bluebird.reject([{ key: 'user', value: 'not found' }])

      await user.sendCode()

      ctx.body = {}
    }
  },
  mobileResend: {
    schema: [['data', true, [['phone', true]]]],
    async method (ctx) {
      const { data: { phone } } = ctx.request.body
      const user = await User.findOne({ where: { phone } })

      if (!user) return Bluebird.reject([{ key: 'user', value: 'User not found' }])

      await user.sendCode()

      ctx.body = {}
    }
  },
  verify: {
    schema: [['data', true, [['code', true]]]],
    async method (ctx) {
      const { data: { code } } = ctx.request.body
      const user = await User.findOne({ where: { code } })

      if (!user) return Bluebird.reject([{ key: 'code', value: 'You provided an incorrect code. Try again or resend.' }])

      user.code = null
      user.isVerified = true
      await user.save()

      ctx.body = { data: { authorized: user.getAuthorized() } }
    }
  },
  verifyReferral: {
    schema: [['data', true, [['code', true]]]],
    async method (ctx) {
      const { data: { code } } = ctx.request.body

      const company = await Company.findOne({ where: { code: code.toLowerCase() } })

      if (!company) return Bluebird.reject([{ key: 'code', value: 'You provided an incorrect code. Try again or connect admin.' }])

      ctx.body = { data: { companyID: company.id } }
    }
  }
})
