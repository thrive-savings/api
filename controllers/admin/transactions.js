module.exports = (User, Account, Transaction, moment, request, Bluebird, amplitude) => ({
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

      amplitude.track({
        eventType: 'FLINKS_AUTHORIZE_CALL',
        userId: user.id,
        eventProperties: {
          LoginID: `${LoginId}`, AccountID: `${defaultAccount.id}`
        }
      })
      const { RequestId, HttpStatusCode: authHttpStatusCode, FlinksCode: authFlinksCode } = await request.post({
        uri: `${process.env.flinksURL}/Authorize`,
        body: { LoginId, MostRecentCached: true },
        json: true
      })
      amplitude.track({
        eventType: 'FLINKS_AUTHORIZE_RETURN',
        userId: user.id,
        eventProperties: {
          LoginID: `${LoginId}`, HttpStatusCode: authHttpStatusCode, FlinksCode: authFlinksCode
        }
      })

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

        amplitude.track({
          eventType: 'FLINKS_GET_ACCOUNTS_CALL',
          userId: user.id,
          eventProperties: {
            RequestBody: getAccountsDetailBody
          }
        })
        const { Accounts, HttpStatusCode: fetchHttpStatusCode, FlinksCode: fetchFlinksCode } = await request.post({
          uri: `${process.env.flinksURL}/GetAccountsDetail`,
          body: getAccountsDetailBody,
          json: true
        })
        amplitude.track({
          eventType: 'FLINKS_GET_ACCOUNTS_RETURN',
          userId: user.id,
          eventProperties: {
            HttpStatusCode: fetchHttpStatusCode, FlinksCode: fetchFlinksCode, AccounsCount: `${Accounts ? Accounts.length : 0}`
          }
        })

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

            if (!storedAccount.transit || !storedAccount.fullName) {
              await storedAccount.update({ fullName, institution, number, transit }, { where: { token: accountToken } })
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

            await Bluebird.all(transactions.map((item) => Transaction.findOrCreate({ where: { token: item.token }, defaults: item })))
          }
        }
      }

      ctx.body = { data: { balance: parseInt(balance * 100) } }
    },
    async onError (error) {
      if (error.error) {
        const { options: { body: { LoginId } }, error: { HttpStatusCode, FlinksCode, Institution } } = error

        const user = await User.findOne({ where: { loginID: LoginId } })
        await User.update({ bankLinked: false }, { where: { id: user.id } })
        amplitude.track({
          eventType: 'FLINKS_USER_UNLINKED',
          userId: user.id,
          eventProperties: {
            LoginId, HttpStatusCode, FlinksCode, Institution,
            error
          }
        })
      }
    }
  }
})
