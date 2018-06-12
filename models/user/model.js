module.exports = (bcrypt, config, JWT, mail, moment, Sequelize, twilio, uuid, mixpanel, aws) => ({
  attributes: {
    acceptedAt: {
      type: Sequelize.DATE,
      field: 'accepted_at'
    },

    email: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },

    phone: {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    },

    password: {
      type: Sequelize.STRING
    },

    code: {
      type: Sequelize.STRING
    },

    isVerified: {
      defaultValue: false,
      type: Sequelize.BOOLEAN,
      field: 'is_verified'
    },

    isActive: {
      defaultValue: true,
      type: Sequelize.BOOLEAN,
      field: 'is_active'
    },

    restorePasswordToken: {
      type: Sequelize.STRING,
      field: 'restore_password_token'
    },

    restorePasswordTokenExpiresAt: {
      type: Sequelize.DATE,
      field: 'restore_password_token_expires_at'
    },

    restorePasswordCode: {
      type: Sequelize.STRING,
      field: 'restore_password_token'
    },

    restorePasswordCodeExpiresAt: {
      type: Sequelize.DATE,
      field: 'restore_password_token_expires_at'
    },

    firstName: {
      type: Sequelize.STRING,
      field: 'first_name'
    },

    middleName: {
      type: Sequelize.STRING,
      field: 'middle_name'
    },

    lastName: {
      type: Sequelize.STRING,
      field: 'last_name'
    },

    dob: {
      type: Sequelize.STRING
    },

    occupation: {
      type: Sequelize.STRING
    },

    unit: {
      type: Sequelize.STRING
    },

    address: {
      type: Sequelize.STRING,
      field: 'address'
    },

    city: {
      type: Sequelize.STRING
    },

    province: {
      type: Sequelize.STRING
    },

    country: {
      type: Sequelize.STRING
    },

    postalCode: {
      type: Sequelize.STRING,
      field: 'postal_code'
    },

    isCanadianResident: {
      type: Sequelize.BOOLEAN,
      field: 'is_canadian_resident'
    },

    isUSResident: {
      type: Sequelize.BOOLEAN,
      field: 'is_us_resident'
    },

    isPoliticallyExposed: {
      type: Sequelize.BOOLEAN,
      field: 'is_politically_exposed'
    },

    isOpeningForThirdParty: {
      type: Sequelize.BOOLEAN,
      field: 'is_opening_for_third_party'
    },

    isTOSAccepted: {
      type: Sequelize.BOOLEAN,
      field: 'is_tos_accepted'
    },

    isPPAccepted: {
      type: Sequelize.BOOLEAN,
      field: 'is_privacy_policy_accepted'
    },

    signature: {
      type: Sequelize.TEXT
    },

    balance: {
      defaultValue: 0,
      type: Sequelize.INTEGER
    },

    avatar: {
      type: Sequelize.TEXT
    },

    createdAt: {
      type: Sequelize.DATE,
      field: 'created_at'
    },

    isWelcomed: {
      defaultValue: false,
      type: Sequelize.BOOLEAN,
      field: 'is_welcomed'
    },

    fetchFrequency: {
      defaultValue: 'ONCEWEEKLY',
      type: Sequelize.STRING,
      field: 'fetch_frequency'
    },

    loginID: {
      type: Sequelize.STRING,
      field: 'login_id'
    },

    bankLinked: {
      type: Sequelize.BOOLEAN,
      field: 'bank_linked',
      defaultValue: false
    },

    companyID: {
      type: Sequelize.INTEGER,
      defaultValue: 1,
      field: 'company_id'
    },

    workType: {
      type: Sequelize.STRING,
      field: 'work_type'
    },

    savingType: {
      type: Sequelize.STRING,
      field: 'saving_type',
      defaultValue: 'Thrive Flex'
    },

    fixedContribution: {
      defaultValue: 2000,
      type: Sequelize.INTEGER,
      field: 'fixed_contribution'
    },

    gender: {
      type: Sequelize.STRING
    },

    savingPreferencesSet: {
      defaultValue: false,
      type: Sequelize.BOOLEAN,
      field: 'saving_preferences_set'
    }
  },
  instanceMethods: {
    greet () {
      twilio.messages.create({
        from: process.env.twilioNumber,
        to: this.phone,
        body: `Welcome ${this.firstName}! You're now part of the Thrive family. My name is Thrivebot and I'm your personal assistant.

I have finished analyzing your account and your first withdrawal will be $5.25. Feel free to message me anytime, ask for your balance, withdraw your money, or just say hi!

Happy saving! ;)`
      })
    },
    checkPassword (password) {
      return bcrypt.compareSync(password, this.password)
    },
    generateJWT () {
      return JWT.sign({ id: this.id, email: this.email }, process.env.key)
    },
    async generateRestorePasswordToken () {
      this.restorePasswordToken = uuid().replace(/-/g, '')
      this.restorePasswordTokenExpiresAt = moment().add(60, 'm').toDate()
      await this.save()
      mail.send({
        from: 'restore@thrivesavings.com',
        html: `
          <html>
            <div>
              <p>To reset your Thrive Savings password, go to ${config.constants.CLIENT_URL}/restore/${this.restorePasswordToken} </p>
              <p>The link will expire after an hour</p>
              <p>If you haven't requested a password reset, you can ignore this message</p>
              <p>-The team at Thrive</p>
            </div>
          </html>`,
        subject: 'Thrive password reset',
        to: this.email
      })
    },
    async generateRestorePasswordCode () {
      const random = () => Math.floor(1000 + Math.random() * 9000)
      const users = await this.constructor.findAll()
      const codes = users.map((item) => item.code)
      let code = random()

      while (codes.includes(code)) {
        code = random()
      }
      this.restorePasswordCode = code
      this.restorePasswordCodeExpiresAt = moment().add(60, 'm').toDate()
      await this.save()
      mail.send({
        from: 'restore@thrivesavings.com',
        html: `
          <html>
            <div>
              <p>To reset your Thrive Savings password, type <b>${this.restorePasswordCode}</b> in your app. </p>
              <p>The code will expire after an hour</p>
              <p>If you haven't requested a password reset, you can ignore this message</p>
              <p>-The team at Thrive</p>
            </div>
          </html>`,
        subject: 'Thrive password reset',
        to: this.email
      })
    },
    async getAvatar () {
      if (this.avatar) {
        const s3 = new aws.S3({
          accessKeyId: process.env.awsAccessKeyID,
          secretAccessKey: process.env.awsSecretKey,
          region: process.env.awsRegion
        })

        const data = {
          Bucket: process.env.awsBucketName,
          Key: this.avatar
        }

        let { Body: avatarData } = await s3.getObject(data).promise()
        avatarData = avatarData.toString('base64')

        return avatarData
      }
    },
    getAuthorized () {
      let account
      if (this.accounts) {
        account = this.accounts.filter(item => !!item.isDefault)[0]
        if (account) {
          account = account.toAuthorized()
          account.flLoginID = this.loginID
        }
      }

      let goals
      if (this.goals) {
        goals = this.goals.sort(({id: id0}, {id: id1}) => (id0 - id1))
        goals = goals.map(
          ({ id, category, name, amount, percentage, desiredDate, createdAt, userID }) => ({ id, category, name, amount, savedAmount: Math.round(this.balance * (percentage / 100)), percentage, desiredDate, createdAt, userID })
        )
      }

      return {
        account,
        goals,
        bankLinked: this.bankLinked,
        didSign: !!this.signature,
        firstName: this.firstName,
        jwt: this.generateJWT(),
        isWelcomed: this.isWelcomed,
        lastName: this.lastName,
        email: this.email,
        phone: this.phone,
        isVerified: this.isVerified,
        balance: this.balance,
        savingPreferences: {
          workType: this.workType,
          savingType: this.savingType,
          savingDetails: {
            fetchFrequency: this.fetchFrequency,
            fixedContribution: this.fixedContribution
          }
        },
        notifications: {
          savingPreferencesSet: this.savingPreferencesSet,
          bonus: 0
        }
      }
    },
    getProfile () {
      const profile = {}
      const dataValues = this.dataValues
      Object.keys(dataValues).forEach((item) => {
        const value = dataValues[item]
        if ([
          'firstName', 'middleName', 'lastName', 'dob', 'occupation', 'unit', 'address', 'city', 'province',
          'country', 'postalCode', 'isCanadianResident', 'isUSResident', 'isPoliticallyExposed', 'isOpeningForThirdParty',
          'isTOSAccepted', 'isPPAccepted', 'signature'
        ].includes(item) && value !== null) profile[item] = value
      })
      let step = 1
      if (profile.lastName) step = 2
      if (profile.occupation) step = 3
      if (profile.postalCode) step = 5
      if (profile.isCanadianResident || profile.isUSResident || profile.isPoliticallyExposed || profile.isOpeningForThirdParty) step = 6
      profile.step = step
      return profile
    },
    hashPassword (password) {
      this.password = bcrypt.hashSync(password, 8)
    },
    async sendCode () {
      const random = () => Math.floor(1000 + Math.random() * 9000)
      const users = await this.constructor.findAll()
      const codes = users.map((item) => item.code)
      let code = random()

      while (codes.includes(code)) {
        code = random()
      }

      this.code = code
      await this.save()
      twilio.messages.create({
        from: process.env.twilioNumber,
        to: this.phone,
        body: `Hi ${this.firstName}, ${code} is your Thrive Savings verification code. Please enter that code on the number verification screen to confirm this phone number is yours.`
      })
    },
    notifyUserAboutTransaction (type, state, amount) {
      let msg

      let dollars = amount / 100
      dollars = dollars % 1 === 0 ? dollars : dollars.toFixed(2)
      dollars.toLocaleString('en-US', {style: 'currency', currency: 'USD'})

      let balance = this.balance / 100
      balance = balance % 1 === 0 ? balance : balance.toFixed(2)
      balance.toLocaleString('en-US', {style: 'currency', currency: 'USD'})

      if (state === 'invalid_amount') {
        msg = `Hi ${this.firstName}, the amount ($${dollars}) you requested to withdraw exceeds your balance ($${balance})`
      } else {
        if (state === 'in_progress') {
          msg = type === 'direct_debit'
            ? `Hi ${this.firstName}! You've got another $${dollars} in transit to your Thrive account. Have a great day!`
            : `Hi ${this.firstName}! You've withdrawn $${dollars} You'll see this amount back in your chequing account today. Your Thrive balance is $${balance}. Thank you.`
        } else {
          msg = type === 'direct_debit'
            ? `${this.firstName} - Your transfer to your Thrive savings account has settled. To get your updated balance, just reply back with 'Balance'. Have a great day!`
            : `Hi ${this.firstName}. Your withdrawal request has settled. As a good friend, I'd love to know what you are spending it on?`
        }
      }

      twilio.messages.create({
        from: process.env.twilioNumber,
        to: this.phone,
        body: msg
      })

      mixpanel.track('Sent Message', {
        'Message': msg,
        'From Phone': process.env.twilioNumber,
        'To Phone': this.phone,
        'Message Type': 'Automatic'
      })
    },
    sendBonusNotification (amount) {
      let amountDollars = amount / 100
      amountDollars = amountDollars % 1 === 0 ? amountDollars : amountDollars.toFixed(2)
      amountDollars.toLocaleString('en-US', {style: 'currency', currency: 'USD'})

      let balanceDollars = this.balance / 100
      balanceDollars = balanceDollars % 1 === 0 ? balanceDollars : balanceDollars.toFixed(2)
      balanceDollars.toLocaleString('en-US', {style: 'currency', currency: 'USD'})

      const msg = `Hi ${this.firstName}! Your employer had contributed $${amountDollars} to your Thrive savings amount. Your updated balance is $${balanceDollars}. Have a great day!`

      twilio.messages.create({
        from: process.env.twilioNumber,
        to: this.phone,
        body: msg
      })

      mixpanel.track('Sent Message', {
        'Message': msg,
        'From Phone': process.env.twilioNumber,
        'To Phone': this.phone,
        'Message Type': 'Automatic'
      })
    }
  },
  associations: {
    hasMany: ['Account', 'Goal', 'Bonus'],
    belongsTo: 'Company'
  },
  hooks: {
    beforeCreate (instance) {
      instance.hashPassword(instance.password)
    }
  },
  indexes: [
    { fields: ['code', 'company_id'] }
  ],
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false
})
