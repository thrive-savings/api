module.exports = (
  bcrypt,
  config,
  JWT,
  mail,
  moment,
  Sequelize,
  twilio,
  uuid,
  amplitude,
  aws
) => ({
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
      field: 'restore_password_code'
    },

    restorePasswordCodeExpiresAt: {
      type: Sequelize.DATE,
      field: 'restore_password_code_expires_at'
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

    forcedFetchFrequency: {
      type: Sequelize.STRING,
      field: 'forced_fetch_frequency'
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

    relinkRequired: {
      defaultValue: false,
      type: Sequelize.BOOLEAN,
      field: 'relink_required'
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
    },

    userType: {
      type: Sequelize.ENUM,
      values: ['regular', 'vip', 'tester', 'admin'],
      defaultValue: 'regular',
      field: 'user_type'
    },

    requireApproval: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      field: 'require_approval'
    },

    onboardingStep: {
      type: Sequelize.STRING,
      field: 'onboarding_step'
    }
  },
  instanceMethods: {
    greet () {
      twilio.messages.create({
        from: process.env.twilioNumber,
        to: this.phone,
        body: `Welcome ${
          this.firstName
        }! You're now part of the Thrive family. My name is Thrivebot and I'm your personal assistant.\n\nFeel free to message me anytime, ask for your balance, withdraw your money, or just say hi!\n\nHappy saving! ;)`
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
      this.restorePasswordTokenExpiresAt = moment()
        .add(60, 'm')
        .toDate()
      await this.save()
      mail.send({
        from: 'restore@thrivesavings.com',
        html: `
          <html>
            <div>
              <p>To reset your Thrive Savings password, go to ${
  config.constants.CLIENT_URL
  }/restore/${this.restorePasswordToken} </p>
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
      const codes = users.map(item => item.code)
      let code = random()

      while (codes.includes(code)) {
        code = random()
      }
      this.restorePasswordToken = code
      this.restorePasswordTokenExpiresAt = moment()
        .add(60, 'm')
        .toDate()
      await this.save()
      mail.send({
        from: 'restore@thrivesavings.com',
        html: `
          <html>
            <div>
              <p>To reset your Thrive Savings password, type <b>${
  this.restorePasswordToken
  }</b> in your app. </p>
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
      let bank
      let account
      if (this.accounts) {
        account = this.accounts.filter(item => !!item.isDefault)[0]
        if (account) {
          bank = account.bank
          account = account.toAuthorized()
          account.flLoginID = this.loginID
        }
      }

      let goals
      if (this.goals) {
        goals = this.goals.sort(({ id: id0 }, { id: id1 }) => id0 - id1)
        goals = goals.map(
          ({
            id,
            category,
            name,
            amount,
            progress,
            weeksLeft,
            boosted,
            userID
          }) => ({
            id,
            category,
            name,
            amount,
            progress,
            weeksLeft,
            boosted,
            userID
          })
        )
      }

      let company
      if (this.company) {
        const { id: companyId, name: companyName, brandLogoUrl } = this.company
        company = { companyId, companyName, brandLogoUrl }
      }

      return {
        company,
        account,
        bank,
        goals,
        id: this.id,
        bankLinked: this.bankLinked,
        relinkRequired: this.relinkRequired,
        didSign: !!this.signature,
        jwt: this.generateJWT(),
        isWelcomed: this.isWelcomed,
        isVerified: this.isVerified,
        onboardingStep: this.onboardingStep,
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email,
        phone: this.phone,
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
      Object.keys(dataValues).forEach(item => {
        const value = dataValues[item]
        if (
          [
            'firstName',
            'middleName',
            'lastName',
            'dob',
            'occupation',
            'unit',
            'address',
            'city',
            'province',
            'country',
            'postalCode',
            'isCanadianResident',
            'isUSResident',
            'isPoliticallyExposed',
            'isOpeningForThirdParty',
            'isTOSAccepted',
            'isPPAccepted',
            'signature'
          ].includes(item) &&
          value !== null
        ) {
          profile[item] = value
        }
      })
      let step = 1
      if (profile.lastName) step = 2
      if (profile.occupation) step = 3
      if (profile.postalCode) step = 5
      if (
        profile.isCanadianResident ||
        profile.isUSResident ||
        profile.isPoliticallyExposed ||
        profile.isOpeningForThirdParty
      ) {
        step = 6
      }
      profile.step = step
      return profile
    },
    hashPassword (password) {
      this.password = bcrypt.hashSync(password, 8)
    },
    async sendCode () {
      const random = () => Math.floor(1000 + Math.random() * 9000)
      const users = await this.constructor.findAll()
      const codes = users.map(item => item.code)
      let code = random()

      while (codes.includes(code)) {
        code = random()
      }

      this.code = code
      await this.save()
      twilio.messages.create({
        from: process.env.twilioNumber,
        to: this.phone,
        body: `Hi ${
          this.firstName
        }, ${code} is your Thrive Savings verification code. Please enter that code on the number verification screen to confirm this phone number is yours.`
      })
    },
    notifyUserAboutTransaction (type, state, amount) {
      let msg

      let dollars = amount / 100
      dollars = dollars % 1 === 0 ? dollars : dollars.toFixed(2)
      dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

      let balance = this.balance / 100
      balance = balance % 1 === 0 ? balance : balance.toFixed(2)
      balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

      if (state === 'invalid_amount') {
        msg = `Hi ${
          this.firstName
        }, the amount of $${dollars} you requested to withdraw exceeds your balance of $${balance}`
      } else {
        if (state === 'in_progress') {
          msg =
            type === 'direct_debit'
              ? `Hi ${
                this.firstName
              }! You've got $${dollars} enroute to Thrive Savings. Keep it up, great job saving!`
              : `Hi ${
                this.firstName
              }! You've withdrawn $${dollars} You’ll see this amount back in your chequing account in 1 business day. Have a great day!`
        } else {
          msg =
            type === 'direct_debit'
              ? `Hi ${
                this.firstName
              }. You’ve got an updated balance at Thrive Savings, reply back with ‘Balance’ to check your progress. Have a great day!`
              : `Hi ${
                this.firstName
              }. Your withdrawal request has settled. As a good friend, I’d love to know what you are spending it on?`
        }
      }

      twilio.messages.create({
        from: process.env.twilioNumber,
        to: this.phone,
        body: msg
      })

      amplitude.track({
        eventType: 'BOT SENT MESSAGE',
        userId: this.id,
        eventProperties: {
          Message: msg,
          Phone: this.phone,
          'Message Type': 'Automatic'
        }
      })
    },
    sendBonusNotification (amount) {
      let amountDollars = amount / 100
      amountDollars =
        amountDollars % 1 === 0 ? amountDollars : amountDollars.toFixed(2)
      amountDollars.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
      })

      let balanceDollars = this.balance / 100
      balanceDollars =
        balanceDollars % 1 === 0 ? balanceDollars : balanceDollars.toFixed(2)
      balanceDollars.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
      })

      const msg = `Hi ${
        this.firstName
      }! Your employer had contributed $${amountDollars} to your Thrive savings amount. Your updated balance is $${balanceDollars}. Have a great day!`

      twilio.messages.create({
        from: process.env.twilioNumber,
        to: this.phone,
        body: msg
      })

      amplitude.track({
        eventType: 'BOT SENT MESSAGE',
        userId: this.id,
        eventProperties: {
          Message: msg,
          Phone: this.phone,
          'Message Type': 'Automatic'
        }
      })
    },
    sendMessage (msg) {
      twilio.messages.create({
        from: process.env.twilioNumber,
        to: this.phone,
        body: msg
      })

      amplitude.track({
        eventType: 'BOT SENT MESSAGE',
        userId: this.id,
        eventProperties: {
          Message: msg,
          Phone: this.phone,
          'Message Type': 'Automatic'
        }
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
  indexes: [{ fields: ['code', 'company_id'] }],
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false
})
