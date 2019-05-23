module.exports = (
  Sequelize,
  User,
  Institution,
  Company,
  Connection,
  Account,
  Goal,
  Bonus,
  Referral,
  Bluebird,
  amplitude,
  request,
  config,
  moment
) => ({
  signIn: {
    schema: [['data', true, [['email', true], ['password', true]]]],
    async method (ctx) {
      const {
        data: { email: providedEmail, password }
      } = ctx.request.body
      const email = providedEmail.toLowerCase()

      const user = await User.findOne({
        include: [
          { model: Connection, include: [Institution, Account] },
          Goal,
          Company
        ],
        where: { email }
      })
      if (!user) {
        return Bluebird.reject([
          {
            key: 'email',
            value:
              'This email is not registered. Please double check for typos or sign up for an account.'
          }
        ])
      }
      if (!user.checkPassword(password)) {
        return Bluebird.reject([
          {
            key: 'password',
            value:
              'You provided an incorrect password. Please try again or reset your password.'
          }
        ])
      }

      const company = await Company.findOne({ where: { id: user.companyID } })
      amplitude.track({
        eventType: 'LOGIN_SUCCESS',
        userId: user.id,
        userProperties: {
          Email: user.email,
          Phone: user.phone,
          Balance: user.balance,
          'First Name': user.firstName,
          'Last Name': user.lastName,
          'Employer ID': company.id,
          'Employer Name': company.name,
          'Employer Code': company.code,
          'Work Type': user.workType,
          'Saving Type': user.savingType,
          'Saving Frequency': user.fetchFrequency,
          'Account Verified': user.isVerified,
          'Next Save Date': user.nextSaveDate
        }
      })

      if (!user.isVerified) {
        await user.sendCode()
      }

      const bonuses = await Bonus.findAll({
        where: {
          userID: user.id,
          companyID: user.companyID,
          notificationSeenDate: null
        }
      })
      let totalBonus = 0
      bonuses.forEach(({ amount }) => {
        totalBonus += amount
      })

      const avatar = await user.getAvatar()
      const authorizedData = user.getData()
      authorizedData.notifications.bonus = totalBonus

      ctx.body = { data: { authorized: authorizedData }, avatar }
    }
  },
  signUp: {
    schema: [
      [
        'data',
        true,
        [
          ['email', true],
          ['password', true],
          ['firstName', true],
          ['lastName', true],
          ['referralCode'],
          ['companyID', true, 'integer']
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: {
          email: providedEmail,
          password,
          firstName,
          lastName,
          companyID: providedCompanyID,
          referralCode
        }
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

      let companyID = providedCompanyID
      let testUser = false
      if (companyID < 0) {
        companyID = 1
        testUser = true
      }

      let user = await User.findOne({ where: { email } })
      if (user) {
        return Bluebird.reject([
          {
            key: 'User',
            value: 'This email is already registered with Thrive.'
          }
        ])
      }

      let referringUser
      if (referralCode) {
        referringUser = await User.findOne({
          where: { referralCode: referralCode.toUpperCase() }
        })
        if (!referringUser) {
          return Bluebird.reject([
            {
              key: 'referral_code',
              value: 'Referral Code is not valid'
            }
          ])
        }
      }

      user = await User.create({
        email,
        password,
        firstName,
        lastName,
        companyID,
        userType: testUser ? 'tester' : 'regular',
        nextSaveDate: moment().add(1, 'd')
      })

      await user.generateReferralCode()
      await Goal.create({
        category: 'RainyDay',
        name: 'Rainy Day Fund',
        userID: user.id
      })
      user.sendWelcomeEmail()

      if (referringUser) {
        const referral = await Referral.create({
          sourceID: referringUser.id,
          targetID: user.id
        })
        request.post({
          uri: `${config.constants.URL}/admin/referral-reward`,
          body: {
            secret: process.env.apiSecret,
            data: {
              referralID: referral.id
            }
          },
          json: true
        })
      }

      const company = await Company.findOne({ where: { id: user.companyID } })
      amplitude.track({
        eventType: 'PERSONAL_DETAILS_SET',
        userId: user.id,
        userProperties: {
          Email: user.email,
          Phone: user.phone,
          Balance: user.balance,
          Goals: 1,
          'First Name': user.firstName,
          'Last Name': user.lastName,
          'Employer ID': company.id,
          'Employer Name': company.name,
          'Employer Code': company.code,
          'Work Type': user.workType,
          'Saving Type': user.savingType,
          'Saving Frequency': user.fetchFrequency,
          'Account Verified': user.isVerified,
          'Next Save Date': user.nextSaveDate,
          'Referral Code': user.referralCode
        }
      })

      user = await User.findOne({
        include: [
          { model: Connection, include: [Institution, Account] },
          Goal,
          Company
        ],
        where: { email }
      })
      ctx.body = { data: { authorized: user.getData() } }
    },
    onError (error) {
      if (error instanceof Sequelize.UniqueConstraintError) {
        const fields = Object.keys(error.fields)
        if (fields.includes('email')) {
          return [{ key: 'email', value: 'This email is already taken.' }]
        }
      }
      if (error instanceof Sequelize.ValidationError) {
        return [{ key: 'email', value: 'This email is not valid.' }]
      }
    }
  }
})
