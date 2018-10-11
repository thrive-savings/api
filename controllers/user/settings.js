module.exports = (
  Bluebird,
  User,
  Account,
  Goal,
  Company,
  Sequelize,
  amplitude,
  moment,
  request,
  config
) => ({
  setPhone: {
    schema: [['data', true, [['phone', true]]]],
    async method (ctx) {
      const {
        data: { phone }
      } = ctx.request.body

      let user = await User.findOne({
        where: { phone, id: { [Sequelize.Op.ne]: ctx.authorized.id } }
      })
      if (user) {
        return Bluebird.reject([
          {
            key: 'phone',
            value:
              'This phone already exists in our system. Please use another one.'
          }
        ])
      }

      user = await User.findOne({
        include: [Account, Goal, Company],
        where: { id: ctx.authorized.id }
      })
      if (user.phone === phone && user.isVerified) {
        return Bluebird.reject([
          {
            key: 'phone',
            value:
              'This phone is already saved as your phone. Please use another one.'
          }
        ])
      }

      if (phone === '9991239876') {
        user.phone = `${phone}-${moment().unix()}`
        user.isVerified = 1
        await user.save()
      } else {
        user.phone = phone
        user.isVerified = 0
        await user.sendCode()
      }

      amplitude.track({
        eventType: 'PHONE_SET',
        userId: user.id,
        userProperties: {
          Phone: user.phone,
          'Account Verified': user.isVerified
        }
      })

      ctx.body = { data: { authorized: user.getAuthorized() } }
    }
  },
  setEmail: {
    schema: [['data', true, [['email', true]]]],
    async method (ctx) {
      const {
        data: { email: providedEmail }
      } = ctx.request.body
      const email = providedEmail.toLowerCase()

      const {
        format_valid: formatValid,
        mx_found: mxFound,
        smtp_check: smtpCheck
      } = await request.get({
        uri: `${config.constants.API_LAYER_URL}?access_key=${
          process.env.emailCheckerToken
        }&email=${email}`,
        json: true
      })
      if (!formatValid || !mxFound || !smtpCheck) {
        return Bluebird.reject([
          { key: 'User', value: 'Please provide valid email.' }
        ])
      }

      let user = await User.findOne({ where: { email } })

      if (user) {
        return Bluebird.reject([
          {
            key: 'email',
            value:
              'This email already exists in our system. Please use another one.'
          }
        ])
      }

      await User.update({ email }, { where: { id: ctx.authorized.id } })

      user = await User.findOne({
        include: [Account, Goal, Company],
        where: { id: ctx.authorized.id }
      })
      amplitude.track({
        eventType: 'EMAIL_UPDATED',
        userId: user.id,
        userProperties: {
          Email: user.email
        }
      })

      ctx.body = { data: { authorized: user.getAuthorized() } }
    }
  },
  setPassword: {
    schema: [['data', true, [['password', true], ['newPassword', true]]]],
    async method (ctx) {
      const {
        data: { password, newPassword }
      } = ctx.request.body

      const user = await User.findOne({
        include: [Account, Goal, Company],
        where: { id: ctx.authorized.id }
      })

      if (!user.checkPassword(password)) {
        return Bluebird.reject([
          {
            key: 'password',
            value:
              'Your original password is incorrect. Please try again or contact support.'
          }
        ])
      }

      user.hashPassword(newPassword)
      await user.save()

      amplitude.track({
        eventType: 'PASSWORD_UPDATED',
        userId: user.id
      })

      ctx.body = { data: { authorized: user.getAuthorized() } }
    }
  }
})
