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
  aws,
  request,
  Goal,
  HelpersService,
  ConstantsService
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

    quovoUserID: {
      type: Sequelize.BIGINT,
      field: 'quovo_user_id'
    },

    quovoUserName: {
      type: Sequelize.STRING,
      field: 'quovo_user_name'
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
    },

    algoBoost: {
      type: Sequelize.INTEGER,
      defaultValue: 100,
      field: 'algo_boost'
    },

    expoPushToken: {
      type: Sequelize.STRING,
      field: 'expo_push_token'
    },

    /*
      [1 - 5]: actual rating #
      0: not rated & should not prompt
      -1: promp the rating
    */
    rating: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      field: 'rating'
    },
    noRatingPromptUntil: {
      type: Sequelize.DATE,
      field: 'no_rating_prompt_until'
    },

    nextSaveDate: {
      type: Sequelize.DATE,
      field: 'next_save_date'
    },

    referralCode: {
      field: 'referral_code',
      type: Sequelize.STRING,
      unique: true
    }
  },
  instanceMethods: {
    sendWelcomeEmail () {
      request.post({
        uri: `${config.constants.URL}/admin/notifications-email`,
        body: {
          secret: process.env.apiSecret,
          data: {
            userIds: [this.id],
            template: 'welcome',
            subject: 'Welcome to Thrive'
          }
        },
        json: true
      })
    },
    sendWelcomeText () {
      twilio.messages.create({
        from: process.env.twilioNumber,
        to: this.phone,
        body: `Welcome ${
          this.firstName
        } to the Thrive community! Your first save will happen tomorrow. Don't forget to link your bank account on the Thrive App.\n\nCongrats on taking the first step towards financial freedom.`
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
      // prettier-ignore
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
      // prettier-ignore
      mail.send({
        from: 'restore@thrivesavings.com',
        html: `
          <html>
            <div>
              <p>To reset your Thrive Savings password, type <b>${this.restorePasswordToken}</b> in your app. </p>
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

    getSavingPreferences () {
      return {
        nextSaveDate: this.nextSaveDate,
        workType: this.workType,
        savingType: this.savingType,
        savingDetails: {
          fetchFrequency: this.fetchFrequency,
          fixedContribution: this.fixedContribution
        }
      }
    },

    getData () {
      return {
        company: this.getCompany(),
        connections: this.getConnections(),
        goals: this.getGoals(),
        id: this.id,
        promptRating: this.shouldPromptRating(),
        expoPushToken: this.expoPushToken,
        bankLinked: this.bankLinked,
        jwt: this.generateJWT(),
        isVerified: this.isVerified,
        onboardingStep: this.onboardingStep,
        referralCode: this.referralCode,
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email,
        phone: this.phone,
        balance: this.balance,
        userType: this.userType,
        savingPreferences: this.getSavingPreferences(),
        notifications: {
          savingPreferencesSet: this.savingPreferencesSet,
          bonus: 0
        }
      }
    },

    getCompany () {
      let company
      if (this.company) {
        company = this.company.getData()
      }
      return company
    },

    getGoals () {
      let goals
      if (this.goals) {
        goals = this.goals.sort(({ id: id0 }, { id: id1 }) => id0 - id1)
        goals = goals.map(goal => goal.getData())
      }
      return goals
    },

    getConnections () {
      let connections
      if (this.connections) {
        connections = this.connections
          .filter(({ status }) => status !== 'dumb')
          .map(connection => connection.getData())
      }
      return connections
    },

    getPrimaryAccount () {
      const data = {}

      const connections = this.connections
      if (connections && connections.length > 0) {
        let defaultConnection = connections.filter(
          connection => connection.isDefault
        )
        if (defaultConnection && defaultConnection.length > 0) {
          defaultConnection = defaultConnection[0]
        }
        if (defaultConnection) {
          data.connection = defaultConnection
          const accounts = defaultConnection.accounts
          if (accounts) {
            let defaultAccount = accounts.filter(account => account.isDefault)
            if (defaultAccount && defaultAccount.length > 0) {
              defaultAccount = defaultAccount[0]
              data.account = defaultAccount
              if (!defaultAccount.hasACH()) {
                data.error = 'no_ach'
              }
            } else {
              data.error = 'no_default_account'
            }
          } else {
            data.error = 'no_accounts'
          }
        } else {
          data.error = 'no_default_connection'
        }
      } else {
        data.error = 'no_connections'
      }

      return data
    },

    daysToNextSave () {
      const now = moment().startOf('day')
      const nextSaveDate = moment(this.nextSaveDate).startOf('day')
      return nextSaveDate.diff(now, 'days')
    },

    async setNextSaveDate () {
      const nextSaveDate = moment()
      switch (this.fetchFrequency) {
        default:
        case 'ONCEWEEKLY':
          nextSaveDate.add(7, 'd')
          break
        case 'BIWEEKLY':
          nextSaveDate.add(15, 'd')
          break
        case 'ONCEMONTHLY':
          nextSaveDate.add(1, 'm')
          break
      }
      this.nextSaveDate = nextSaveDate
      await this.save()

      amplitude.track({
        eventType: 'NEXT_SAVE_DATE_UPDATED',
        userId: this.id,
        userProperties: {
          'Next Save Date': nextSaveDate
        }
      })
    },

    shouldPromptRating () {
      return (
        this.rating === -1 &&
        (!this.noRatingPromptUntil || this.noRatingPromptUntil < moment())
      )
    },

    async canPromptRating () {
      if (this.rating === 0) {
        this.rating = -1
        await this.save()
      }
    },

    getReferralLink () {
      return `${config.constants.BRANCH_APP_LINK}/${this.getReferralCode()}`
    },

    async generateReferralCode () {
      const random = () => Math.floor(10000 + Math.random() * 90000)
      const users = await this.constructor.findAll({
        where: { referralCode: { [Sequelize.Op.ne]: null } }
      })
      const codes = users.map(item => item.referralCode.substring(3))
      let code = random()

      while (codes.includes(code)) {
        code = random()
      }

      const name = this.firstName ? this.firstName : this.lastName
      this.referralCode = `${name.substring(0, 3).toUpperCase()}${code}`
      await this.save()
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

    async updateBalance (amount, type) {
      const { TYPES } = ConstantsService.TRANSFER

      const deltaAmount =
        type === TYPES.CREDIT ? -1 * parseInt(amount) : parseInt(amount)
      this.balance = parseInt(this.balance) + deltaAmount
      await this.save()
      await Goal.distributeAmount(deltaAmount, this.id)

      amplitude.track({
        eventType: 'BALANCE_UPDATED',
        userId: this.id,
        userProperties: {
          Balance: this.balance
        }
      })

      if (type === TYPES.CREDIT || this.balance >= 50000) {
        this.canPromptRating()
      }
    },

    async undoBalanceUpdate (amount, type) {
      const { TYPES } = ConstantsService.TRANSFER

      const deltaAmount =
        type === TYPES.CREDIT ? -1 * parseInt(amount) : parseInt(amount)
      this.balance = parseInt(this.balance) - deltaAmount
      await this.save()
      await Goal.distributeAmount(-1 * deltaAmount, this.id)

      amplitude.track({
        eventType: 'BALANCE_UPDATE_UNDONE',
        userId: this.id,
        userProperties: {
          Balance: this.balance
        }
      })
    },

    formInvalidWithdrawalMessage (amount, withdrawsInProgress) {
      let msg
      if (withdrawsInProgress) {
        msg = `We cannot process your withdraw request due to previous withdraw request(s) of ${HelpersService.getDollarString(
          withdrawsInProgress
        )} which will bring your balance to ${HelpersService.getDollarString(
          this.balance - withdrawsInProgress
        )}.`
      } else {
        msg = `The amount of ${HelpersService.getDollarString(
          amount
        )} you requested to withdraw exceeds your balance of ${HelpersService.getDollarString(
          this.balance
        )}.`
      }

      return msg
    },

    notifyAboutTransfer (amount, subtype, state) {
      const dollarizedAmount = HelpersService.getDollarString(amount)
      const dollarizedBalance = HelpersService.getDollarString(this.balance)

      const { SUBTYPES, STATES } = ConstantsService.TRANSFER

      let msg
      if ([SUBTYPES.SAVE, SUBTYPES.WITHDRAW].includes(subtype)) {
        if (state === STATES.PROCESSING) {
          msg =
            subtype === SUBTYPES.SAVE
              ? `You've got ${dollarizedAmount} enroute to Thrive Savings. Keep it up, great job saving!`
              : `You've withdrawn ${dollarizedAmount} You’ll see this amount back in your chequing account in 1 business day. Have a great day!`
        } else if (state === STATES.COMPLETED) {
          msg =
            subtype === SUBTYPES.SAVE
              ? `You’ve got an updated balance at Thrive Savings, reply back with ‘Balance’ to check your progress. Have a great day!`
              : `Your withdrawal request has settled. As a good friend, I’d love to know what you are spending it on?`
        }
      } else {
        msg = `You've been rewarded with ${dollarizedAmount}. Your updated balance is ${dollarizedBalance}. Have a great day!`
      }

      if (msg) {
        msg = `Hi ${this.firstName}. ${msg}`
        twilio.messages.create({
          from: process.env.twilioNumber,
          to: this.phone,
          body: msg
        })
        amplitude.track({
          eventType: 'BOT_SENT_MESSAGE',
          userId: this.id,
          eventProperties: {
            msg,
            phone: this.phone,
            messageType: 'Automatic'
          }
        })
      }
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

    sendBonusNotification (amount, type = 'employer') {
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

      let msg = ''
      if (type === 'referral') {
        msg = `Hi ${
          this.firstName
        }! Your referral bonus $${amountDollars} is added to your Thrive savings amount. Your updated balance is $${balanceDollars}. Have a great day!`
      } else {
        msg = `Hi ${this.firstName}! ${
          type === 'momentum_offer' ? 'Momentum' : 'Your employer'
        } had contributed $${amountDollars} to your Thrive savings amount. Your updated balance is $${balanceDollars}. Have a great day!`
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

    sendMessage (msg, type = 'Automatic') {
      twilio.messages.create({
        from: process.env.twilioNumber,
        to: this.phone,
        body: msg
      })

      amplitude.track({
        eventType: 'BOT_SENT_MESSAGE',
        userId: this.id,
        eventProperties: {
          Message: msg,
          Phone: this.phone,
          'Message Type': type
        }
      })
    },

    async sendMessageAsync (msg, type = 'Automatic') {
      await twilio.messages.create({
        from: process.env.twilioNumber,
        to: this.phone,
        body: msg
      })

      amplitude.track({
        eventType: 'BOT_SENT_MESSAGE',
        userId: this.id,
        eventProperties: {
          Message: msg,
          Phone: this.phone,
          'Message Type': type
        }
      })
    },

    updateAlgoBoost (scale) {
      const xIndex = scale.indexOf('x')
      if (xIndex > 0) {
        scale = scale.substr(0, xIndex)
      }

      this.algoBoost *= scale
      this.save()

      return `Done! We will adjust your next savings by ${scale + 'x'}`
    },

    daysLeftToNextPull () {
      let frequency = this.forcedFetchFrequency
      if (!frequency) {
        frequency = this.fetchFrequency
      }

      let nextRunMoment = moment()
      const dateOfMonth = nextRunMoment.date()
      switch (frequency) {
        case 'ONCEWEEKLY':
          nextRunMoment = nextRunMoment.add(1, 'weeks').day(1)
          break
        case 'BIWEEKLY':
          nextRunMoment =
            dateOfMonth < 15
              ? nextRunMoment.date(15)
              : nextRunMoment.add(1, 'months').date(1)
          break
        case 'ONCEMONTHLY':
          nextRunMoment = nextRunMoment.add(1, 'months').date(1)
          break
        case 'SPECIALMONTHLY':
          nextRunMoment =
            dateOfMonth < 15
              ? nextRunMoment.date(15)
              : nextRunMoment.add(1, 'months').date(15)
          break
        default:
          nextRunMoment = nextRunMoment.add(1, 'days')
          break
      }

      return nextRunMoment.diff(moment(), 'days')
    },

    async unlink ({ error = '', options = {} } = {}) {
      this.relinkRequired = true
      await this.save()

      amplitude.track({
        eventType: 'FLINKS_USER_UNLINKED',
        userId: this.id,
        userProperties: {
          'Relink Required': this.relinkRequired
        },
        eventProperties: {
          error,
          options
        }
      })

      const notificationMsg = `Hi ${
        this.firstName
      }. For your security, we need you to authenticate your bank account again. Please open the Thrive app to continue saving.`

      if (this.requireApproval || this.userType === 'vip') {
        await request.post({
          uri: `${config.constants.URL}/slack-request-notification-approval`,
          body: {
            data: {
              userID: this.id,
              text: notificationMsg
            }
          },
          json: true
        })
      } else {
        this.sendMessage(notificationMsg)
      }

      // Schedule future notifications
      request.post({
        uri: `${config.constants.URL}/admin/notifications-schedule-unlink`,
        body: {
          secret: process.env.apiSecret,
          data: { userID: this.id }
        },
        json: true
      })
    }
  },
  associations: {
    hasMany: [
      'Connection',
      'Goal',
      'Transfer',
      'Bonus',
      'Notification',
      'Debt',
      'MomentumOffer',
      'SynapseNode'
    ],
    belongsTo: 'Company',
    hasOne: 'SynapseEntry'
  },
  hooks: {
    beforeCreate (instance) {
      instance.hashPassword(instance.password)
    }
  },
  indexes: [{ fields: ['code', 'company_id'] }],
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false,
  noRatingPromptUntil: false,
  nextSaveDate: false
})
