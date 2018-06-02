module.exports = (Account, Bluebird, request, User, mixpanel) => ({
  fetchNew: {
    schema: [['data', true, [['loginID', true]]]],
    async method (ctx) {
      const { data: { loginID: LoginId } } = ctx.request.body
      let accounts = []
      let transactions = []
      let bank = ''

      // Call Authorize to get RequestId
      console.log(`Calling Authorize for ${LoginId}`)
      const authRes = await request.post({
        uri: `${process.env.flinksURL}/Authorize`,
        body: { LoginId, MostRecentCached: true },
        json: true
      })
      console.log(authRes)
      const { RequestId, HttpStatusCode: authHttpStatusCode, FlinksCode: authFlinksCode } = authRes
      console.log(`Authorize returned RequestId: ${RequestId}, HttpStatusCode: ${authHttpStatusCode}, FlinksCode: ${authFlinksCode}`)

      // Call GetAccountsDetail
      console.log(`Calling GetAccountsDetail with RequestId: ${RequestId}`)
      const fetchRes = await request.post({
        uri: `${process.env.flinksURL}/GetAccountsDetail`,
        body: { RequestId, MostRecentCached: true },
        json: true
      })
      console.log(fetchRes)
      const { HttpStatusCode: fetchHttpStatusCode, FlinksCode: fetchFlinksCode } = fetchRes
      console.log(`GetAccountsDetail returned HttpStatusCode: ${fetchHttpStatusCode}, FlinksCode: ${fetchFlinksCode}`)

      if (fetchFlinksCode === 'OPERATION_PENDING') {
        let retryNumber = 0
        let fetchResult = fetchFlinksCode
        while (fetchResult === 'OPERATION_PENDING' && retryNumber < 20) {
          console.log(`Calling GetAccountsDetailAsync with RequestId: ${RequestId}`)
          const fetchAsyncRes = await request.get({
            uri: `${process.env.flinksURL}/GetAccountsDetailAsync/${RequestId}`
          })
          console.log(fetchAsyncRes)
          fetchResult = fetchAsyncRes.FlinksCode
          console.log(`GetAccountsDetailAsync returned with FlnksCode: ${fetchResult}, Retry number: ${retryNumber}`)
          retryNumber++
        }
      } else {
        const { Accounts, Institution } = fetchRes
        accounts = Accounts
        bank = Institution
        transactions.concat(Accounts.transactions)

        console.log(`Got the bank info for Institution: ${bank}`)
        console.log(accounts)
        console.log(transactions)
      }
    }
  },
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
        console.log(`Calling Authorize with LoginId ${LoginId}, try number ${retryNumber}`)
        const { RequestId, Login: { LastRefresh }, HttpStatusCode, FlinksCode } = await request.post({
          uri: `${process.env.flinksURL}/Authorize`,
          body: { LoginId, MostRecentCached: true },
          json: true
        })
        lastRefresh = LastRefresh
        console.log(`Authorize returned, RequestId: ${RequestId}, LastRefresh: ${lastRefresh}, Request Status: ${HttpStatusCode}, FlinksCode: ${FlinksCode}`)

        console.log(`Fetching accounts for ${RequestId}, try number ${retryNumber}`)
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
        console.log(`Fetched RequestId: ${RequestId}, Number of Accounts: ${accounts.length}, Institution: ${bank}`)
      }

      mixpanel.track('Fetching Bank Accounts Result', { Date: `${new Date()}`, UserId: `${ctx.authorized.id}`, LoginId: `${LoginId}`, AccountsCount: `${accounts.length}` })

      await User.update({ loginID: LoginId }, { where: { id: ctx.authorized.id } })

      if (accounts.length === 0) return [{ key: 'flinks', value: 'Server could not fetch accounts successfully. Please contact support' }]
      console.log(accounts)
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
