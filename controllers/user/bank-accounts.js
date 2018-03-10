module.exports = (Account, Bluebird, request, User) => ({
  fetch: {
    schema: [['data', true, [['loginID', true]]]],
    async method (ctx) {
      let retryNumber = 0
      const { data: { loginID: LoginId } } = ctx.request.body
      let lastRefresh = '0001-01-01T00:00:00'
      let accounts = []
      let bank = ''
      while (lastRefresh === '0001-01-01T00:00:00' && retryNumber < 10) {
        console.log(`Calling Authorize with LoginId ${LoginId}, try number ${retryNumber}`)
        const { RequestId, Login: { LastRefresh }, HttpStatusCode, FlinksCode } = await request.post({
          uri: `${process.env.flinksURL}/Authorize`,
          body: { LoginId },
          json: true
        })
        lastRefresh = LastRefresh
        console.log(`Authorize returned, RequestId: ${RequestId}, LastRefresh: ${lastRefresh}, Request Status: ${HttpStatusCode}, FlinksCode: ${FlinksCode}`)

        console.log(`Fetching accounts for ${RequestId}, try number ${retryNumber}`)
        let { Accounts, Institution } = await request.post({
          uri: `${process.env.flinksURL}/GetAccountsSummary`,
          body: { RequestId },
          json: true
        })
        accounts = Accounts
        bank = Institution

        retryNumber++
        console.log(`Fetched RequestId: ${RequestId}, Number of Accounts: ${accounts.length}, Institution: ${bank}`)
      }

      await User.update({ loginID: LoginId }, { where: { id: ctx.authorized.id } })

      accounts = await Bluebird.all(
        accounts.map(({
          AccountNumber: number,
          Category: type,
          Id: token,
          Title: title
        }) => Account.create({
          bank,
          number,
          title,
          token,
          type,
          userID: ctx.authorized.id
        })))

      accounts = accounts.map(({ dataValues }) => ({ id: dataValues.id, number: dataValues.number, title: dataValues.title, bank: bank, loginid: LoginId }))

      ctx.body = { data: { PageIntegration: { accounts } } }
    },
    onError ({ error: { FlinksCode: code } = {} }) {
      if (code) return [{ key: 'flinks', value: code }]
    }
  },
  setDefault: {
    schema: [['data', true, [['accountID', true, 'integer']]]],
    async method (ctx) {
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
