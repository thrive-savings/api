module.exports = (
  Bluebird,
  User,
  Institution,
  Company,
  Connection,
  Account,
  Goal,
  amplitude
) => ({
  resend: {
    schema: [['data', true, [['phone', true]]]],
    async method (ctx) {
      const {
        data: { phone }
      } = ctx.request.body
      const user = await User.findOne({ where: { phone } })

      if (!user) {
        return Bluebird.reject([{ key: 'user', value: 'User not found' }])
      }

      await user.sendCode()

      ctx.body = {}
    }
  },
  verify: {
    schema: [['data', true, [['code', true]]]],
    async method (ctx) {
      const {
        data: { code }
      } = ctx.request.body
      const user = await User.findOne({
        include: [
          { model: Connection, include: [Institution, Account] },
          Goal,
          Company
        ],
        where: { code }
      })

      if (!user) {
        return Bluebird.reject([
          {
            key: 'code',
            value: 'You provided an incorrect code. Try again or resend.'
          }
        ])
      }

      user.code = null
      user.isVerified = true
      await user.save()

      amplitude.track({
        eventType: 'ACCOUNT_VERIFIED',
        userId: user.id,
        userProperties: {
          'Account Verified': user.isVerified
        }
      })

      ctx.body = { data: { authorized: user.getData() } }
    }
  },
  verifyCompanyCode: {
    schema: [['data', true, [['code', true]]]],
    async method (ctx) {
      const {
        data: { code: receivedCode }
      } = ctx.request.body
      const code = receivedCode.toLowerCase().trim()

      let companyName = 'Test Company'
      let companyID = -1
      let companyLogoUrl
      if (code !== 'testcompany') {
        const company = await Company.findOne({ where: { code } })
        if (!company) {
          return Bluebird.reject([
            {
              key: 'code',
              value:
                'You provided an incorrect code. Try again or connect admin.'
            }
          ])
        }
        companyID = company.id
        companyName = company.name
        companyLogoUrl = company.brandLogoUrl
      }

      ctx.body = {
        data: { companyID, companyName, companyCode: code, companyLogoUrl }
      }
    }
  }
})
