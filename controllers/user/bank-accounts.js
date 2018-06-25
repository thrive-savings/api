module.exports = (User, Account, Transaction, Bluebird, request, config, mixpanel, scheduler, moment) => ({
  fetch: {
    schema: [['data', true, [['loginID', true]]]],
    async method (ctx) {
      const delay = (ms = 1000) => new Promise(resolve => setTimeout(resolve, ms))

      let retryNumber = 0
      const { data: { loginID: LoginId } } = ctx.request.body
      let lastRefresh = '0001-01-01T00:00:00'
      let accounts = []
      let bank = ''
      while ((lastRefresh === '0001-01-01T00:00:00' || accounts.length === 0) && retryNumber < 20) {
        const { RequestId, Login: { LastRefresh } } = await request.post({
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

      mixpanel.track('Fetching Bank Accounts', { Date: `${new Date()}`, UserId: `${ctx.authorized.id}`, LoginId: `${LoginId}`, AccountsCount: `${accounts.length}` })

      await User.update({ loginID: LoginId, bankLinked: true }, { where: { id: ctx.authorized.id } })

      if (accounts.length === 0) return [{ key: 'flinks', value: 'Server could not fetch accounts successfully. Please contact support' }]

      accounts = await Bluebird.all(
        accounts.map(({
          AccountNumber: number,
          Category: type,
          Id: token,
          Title: title
        }) => Account.findOrCreate({
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
        })))

      accounts = accounts.filter(([{ dataValues }]) => dataValues.type === 'Operations')
      accounts = accounts.map(([{ dataValues }]) => ({ id: dataValues.id, number: dataValues.number, title: dataValues.title, bank: bank, loginid: LoginId }))

      ctx.body = { data: { PageIntegration: { accounts } } }
    },
    onError ({ error: { FlinksCode: code } = {} }) {
      if (code) return [{ key: 'flinks', value: code }]
    }
  },
  setDefault: {
    schema: [['data', true, [['accountID', true, 'integer']]]],
    async method (ctx) {
      await Account.update({ isDefault: false }, { where: { user_id: ctx.authorized.id, isDefault: true } })
      const account = await Account.findOne({ where: { id: ctx.request.body.data.accountID } })
      account.isDefault = true
      await account.save()

      const user = await User.findOne({ where: { id: ctx.authorized.id } })
      user.greet()

      let authorizedAccount = account.toAuthorized()
      authorizedAccount.flLoginID = user.loginID

      ctx.body = { data: { authorized: { account: authorizedAccount } } }
    }
  }
})
