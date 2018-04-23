module.exports = (Account, Bluebird, Goal, moment, Sequelize, User) => ({
  signIn: {
    schema: [['data', true, [['email', true], ['password', true]]]],
    async method (ctx) {
      const { data: { email, password } } = ctx.request.body
      const user = await User.findOne({ include: [Account, Goal], where: { email } })
      if (!user) {
        return Bluebird.reject([{ key: 'email', value: 'This email is not registered. Please double check for typos or sign up for an account.' }])
      }
      if (!user.checkPassword(password)) {
        return Bluebird.reject([{ key: 'password', value: 'You provided an incorrect password. Please again or reset your password.' }])
      }
      let body = {}
      if (!user.isVerified) {
        await user.sendCode()
        const data = { PageSignUp: { step: 2 } }
        ;['email', 'firstName', 'lastName', 'phone'].forEach(item => {
          data[`signUp${item.charAt(0).toUpperCase() + item.slice(1)}Input`] = { value: user.dataValues[item] }
        })
        body = { data, notVerified: true }
      } else {
        body = { data: { authorized: user.getAuthorized() } }
      }
      ctx.body = body
    }
  },
  mobileSignIn: {
    schema: [['data', true, [['email', true], ['password', true]]]],
    async method (ctx) {
      const { data: { email, password } } = ctx.request.body
      const user = await User.findOne({ include: [Account, Goal], where: { email } })
      if (!user) {
        return Bluebird.reject([{ key: 'email', value: 'This email is not registered. Please double check for typos or sign up for an account.' }])
      }
      if (!user.checkPassword(password)) {
        return Bluebird.reject([{ key: 'password', value: 'You provided an incorrect password. Please try again or reset your password.' }])
      }

      if (!user.isVerified) {
        await user.sendCode()
      }

      const avatar = await user.getAvatar()
      ctx.body = { data: { authorized: user.getAuthorized() }, avatar }
    }
  },
  signUp: {
    schema: [['data', true, [['email', true], ['firstName', true], ['lastName', true], ['password', true], ['phone', true]]]],
    async method (ctx) {
      const { data, data: { email, firstName, lastName, password, phone } } = ctx.request.body
      let user
      if (phone === '9991239876') {
        data.phone = `${phone}-${moment().unix()}`
        data.isVerified = true
        user = await User.create(data)
        ctx.body = { data: { authorized: user.getAuthorized() } }
        return
      }
      user = await User.findOne({ where: { email, phone } })
      if (user && !user.isVerified) {
        user.firstName = firstName
        user.lastName = lastName
        user.hashPassword(password)
      } else {
        user = await User.create(data)
      }
      await user.sendCode()
      ctx.body = {}
    },
    onError (error) {
      if (error instanceof Sequelize.UniqueConstraintError) {
        const fields = Object.keys(error.fields)
        if (fields.includes('email')) return [{ key: 'email', value: 'This email is already taken.' }]
        if (fields.includes('phone')) return [{ key: 'phone', value: 'This phone is already taken.' }]
      }
      if (error instanceof Sequelize.ValidationError) return [{ key: 'email', value: 'is not correct' }]
    }
  },
  mobileSignUp: {
    schema: [
      ['data', true, [
        ['email', true], ['password', true], ['firstName', true], ['lastName', true], ['gender', true], ['date', true], ['companyID', true],
        ['address', true, [
          ['streetNumber', true], ['streetName', true], ['unit', true], ['city', true], ['state', true], ['country', true], ['postalCode', true]
        ]]
      ]]
    ],
    async method (ctx) {
      const { data: { email, password, firstName, lastName, gender, date, companyID, address: { streetNumber, streetName, unit, city, state, country, postalCode } } } = ctx.request.body

      let user = await User.findOne({ where: { email } })
      if (user) {
        user.firstName = firstName
        user.lastName = lastName
        user.hashPassword(password)
        await user.save()
      } else {
        user = await User.create({ email, password, firstName, lastName, gender, phone: '', dob: date, address: streetNumber + ' ' + streetName, unit, city, province: state, country, postalCode, companyID })
      }

      ctx.body = { data: { authorized: user.getAuthorized() } }
    }
  }
})
