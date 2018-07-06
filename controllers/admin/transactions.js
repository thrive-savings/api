module.exports = (User, Account, Transaction, moment, request, Bluebird, mixpanel) => ({
  fetchInterval: {
    schema: [[
      ['end'], ['userIDs', 'array'], ['start']
    ]],
    async method (ctx) {
      const { end, start, userIDs } = ctx.request.body
      const query = { include: [{ model: Account }], where: {} }
      if (end) query.where.date = { $lte: moment(end).toDate() }
      if (start) query.where.date = Object.assign({}, query.where.date, { $gte: moment(start).toDate() })
      if (userIDs) query.include = [{ model: Account, where: { userID: [].concat(userIDs) } }]

      const transactions = await Transaction.findAll(query)

      ctx.body = { data: { transactions: transactions.map(({ dataValues, account }) => Object.assign({}, dataValues, { account })) } }
    }
  },
  fetchUser: {
    schema: [['data', true, [['userID', true, 'integer']]]],
    async method (ctx) {
      const { data: { userID } } = ctx.request.body

      const user = await User.findOne({ where: { id: userID } })
      const LoginId = user.loginID
      const defaultAccount = await Account.findOne({ where: { isDefault: true, userID } })

      mixpanel.track('Authorizing Flinks Connection Called', { UserID: `${user.id}`, LoginID: `${LoginId}`, AccountID: `${defaultAccount.id}` })
      const { RequestId, HttpStatusCode: authHttpStatusCode, FlinksCode: authFlinksCode } = await request.post({
        uri: `${process.env.flinksURL}/Authorize`,
        body: { LoginId, MostRecentCached: true },
        json: true
      })
      mixpanel.track('Authorizing Flinks Connection Returned', { UserID: `${user.id}`, LoginID: `${LoginId}`, HttpStatusCode: authHttpStatusCode, FlinksCode: authFlinksCode })

      let balance = 0
      let unlinkBank = false
      if (authHttpStatusCode === 200) {
        const getAccountsDetailBody = { RequestId, WithAccountIdentity: true, WithTransactions: true, AccountsFilter: [defaultAccount.token] }

        const lastTransaction = await Transaction.findOne({ order: [['date', 'DESC']], where: { accountID: defaultAccount.id } })
        if (lastTransaction) {
          getAccountsDetailBody.LastRefresh = [{ AccountId: defaultAccount.id, TransactionId: lastTransaction.token }]
        } else {
          getAccountsDetailBody.DaysOfTransactions = 'Days90'
        }

        mixpanel.track('Fetching New Transactions Called', { UserID: user.id, RequestBody: getAccountsDetailBody })
        const { Accounts, HttpStatusCode: fetchHttpStatusCode, FlinksCode: fetchFlinksCode } = await request.post({
          uri: `${process.env.flinksURL}/GetAccountsDetail`,
          body: getAccountsDetailBody,
          json: true
        })
        mixpanel.track('Fetching New Transactions Returned', { UserID: user.id, HttpStatusCode: fetchHttpStatusCode, FlinksCode: fetchFlinksCode, AccounsCount: `${Accounts ? Accounts.length : 0}` })

        if (fetchHttpStatusCode === 200) {
          for (const fetchedAccount of Accounts) {
            let {
              Balance: { Current: accountBalance = 0 } = {},
              Holder: { Name: fullName = '' } = {},
              InstitutionNumber: institution,
              AccountNumber: number,
              Transactions: transactions = [],
              TransitNumber: transit,
              Id: accountToken
            } = fetchedAccount

            if (accountToken === defaultAccount.token) { balance = accountBalance }

            const storedAccount = await Account.findOne({ where: { token: accountToken } })

            if (!storedAccount.transit) {
              await Account.update({ fullName, institution, number, transit }, { where: { token: accountToken } })
            }

            transactions = transactions.reverse().map(
              ({
                Balance: balance,
                Credit: credit,
                Date: date,
                Debit: debit,
                Description: description,
                Id: token
              }) => ({
                accountID: storedAccount.id,
                amount: parseInt((credit || debit) * 100),
                balance: parseInt(balance * 100),
                date,
                description,
                token,
                type: credit ? 'credit' : debit ? 'debit' : null
              })
            )

            mixpanel.track('Transactions Created on Database', { TransactionsCount: transactions.length })
            await Bluebird.all(transactions.map((item) => Transaction.findOrCreate({ where: { token: item.token }, defaults: item })))
          }
        } else {
          unlinkBank = true
          mixpanel.track('Initial Transfer GetAccountsDetail Call Failed', { Date: `${new Date()}`, UserId: `${userID}`, LoginId: `${LoginId}`, RequestId: `${RequestId}`, HttpStatusCode: `${fetchHttpStatusCode}`, FlinksCode: `${fetchFlinksCode}` })
        }
      } else {
        unlinkBank = false
        mixpanel.track('Initial Transfer Authorize Call Failed', { Date: `${new Date()}`, UserId: `${userID}`, LoginId: `${LoginId}`, HttpStatusCode: `${authHttpStatusCode}`, FlinksCode: `${authFlinksCode}` })
      }

      if (unlinkBank) {
        user.bankLinked = false
        await user.save()
      }

      ctx.body = { data: { balance: balance * 100 } }
    },
    onError (error) {
      console.log(error)
      mixpanel('Error Happened - Fetching User Transactions', { Error: error, StringifiedError: JSON.stringify(error) })
    }
  }
})
