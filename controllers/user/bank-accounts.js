module.exports = (User, Account, Bluebird, request, amplitude) => ({
  fetch: {
    schema: [['data', true, [['loginID', true]]]],
    async method (ctx) {
      const delay = (ms = 1000) =>
        new Promise(resolve => setTimeout(resolve, ms))

      const {
        data: { loginID: LoginId }
      } = ctx.request.body

      let questions = []
      const { Message, Questions } = await request.get({
        uri: `${process.env.flinksURL}/GetMFAQuestions/${LoginId}`,
        json: true
      })
      if (Message === 'SUCCESS') {
        questions = Questions
      }

      let retryNumber = 0
      let lastRefresh = '0001-01-01T00:00:00'
      let accounts = []
      let bank = ''
      while (
        (lastRefresh === '0001-01-01T00:00:00' || accounts.length === 0) &&
        retryNumber < 20
      ) {
        const {
          RequestId,
          Login: { LastRefresh }
        } = await request.post({
          uri: `${process.env.flinksURL}/Authorize`,
          body: { LoginId, MostRecentCached: true },
          json: true
        })
        lastRefresh = LastRefresh

        const { Accounts, Institution } = await request.post({
          uri: `${process.env.flinksURL}/GetAccountsSummary`,
          body: { RequestId, MostRecentCached: true },
          json: true
        })
        if (Accounts) {
          accounts = Accounts
          bank = Institution
        } else {
          await delay(3000)
        }

        retryNumber++
      }

      amplitude.track({
        eventType: 'FLINKS_INITIAL_FETCH',
        userId: ctx.authorized.id,
        eventProperties: {
          LoginId: `${LoginId}`,
          AccountsCount: `${accounts.length}`
        }
      })

      await User.update(
        { loginID: LoginId },
        { where: { id: ctx.authorized.id } }
      )

      if (accounts.length === 0) {
        amplitude.track({
          eventType: 'FETCH_ACCOUNTS_FAIL',
          userId: ctx.authorized.id,
          eventProperties: { LoginId, Bank: bank }
        })
        return [
          {
            key: 'flinks',
            value:
              'Server could not fetch accounts successfully. Please contact support'
          }
        ]
      }

      amplitude.track({
        eventType: 'FETCH_ACCOUNTS_SUCCESS',
        userId: ctx.authorized.id,
        userProperties: { LoginId, Bank: bank },
        eventProperties: { 'Accounts Count': accounts.length }
      })

      accounts = await Bluebird.all(
        accounts.map(
          ({
            AccountNumber: number,
            Category: type,
            Id: token,
            Title: title
          }) =>
            Account.findOrCreate({
              where: {
                token
              },
              defaults: {
                bank,
                number,
                title,
                token,
                type,
                userID: ctx.authorized.id
              }
            })
        )
      )

      accounts = accounts.filter(
        ([{ dataValues }]) => dataValues.type === 'Operations'
      )
      accounts = accounts.map(([{ dataValues }]) => ({
        id: dataValues.id,
        number: dataValues.number,
        title: dataValues.title,
        bank: bank,
        loginid: LoginId
      }))

      ctx.body = { data: { accounts, questions, bank } }
    },
    onError ({ error: { FlinksCode: code } = {} }) {
      if (code) return [{ key: 'flinks', value: code }]
    }
  },

  answerMFAQuestions: {
    schema: [['data', true, [['questions', true, 'array']]]],
    async method (ctx) {
      const {
        data: { questions }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: ctx.authorized.id } })

      await request.patch({
        uri: `${process.env.flinksURL}/AnswerMFAQuestions`,
        body: { LoginId: user.loginID, Questions: questions },
        json: true
      })

      ctx.body = {}
    }
  },

  setDefault: {
    schema: [['data', true, [['accountID', true, 'integer']]]],
    async method (ctx) {
      await Account.update(
        { isDefault: false },
        { where: { user_id: ctx.authorized.id, isDefault: true } }
      )
      const account = await Account.findOne({
        where: { id: ctx.request.body.data.accountID }
      })
      account.isDefault = true
      await account.save()

      const user = await User.findOne({ where: { id: ctx.authorized.id } })

      if (user.bankLinked && user.relinkRequired) {
        user.relinkRequired = false
      } else if (!user.bankLinked) {
        user.bankLinked = true
        user.onboardingStep = 'SavingPreferences'
        user.greet()
      }
      await user.save()

      amplitude.track({
        eventType: 'DEFAULT_ACCOUNT_SET',
        userId: ctx.authorized.id,
        userProperties: { 'Bank Linked': true }
      })

      let authorizedAccount = account.toAuthorized()
      authorizedAccount.flLoginID = user.loginID

      ctx.body = { data: { authorized: { account: authorizedAccount } } }
    }
  }
})
