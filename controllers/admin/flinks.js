module.exports = (
  User,
  Account,
  Transaction,
  amplitude,
  Sentry,
  Bluebird,
  request
) => ({
  fetchTransactions: {
    schema: [['data', true, [['userID', true, 'integer']]]],
    async method (ctx) {
      const {
        data: { userID }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: userID } })
      if (!user) {
        return Bluebird.reject([
          { key: 'user', value: `User not found for ID: ${userID}` }
        ])
      }

      try {
        const LoginId = user.loginID
        const defaultAccount = await Account.findOne({
          where: { isDefault: true, userID }
        })

        amplitude.track({
          eventType: 'FLINKS_AUTHORIZE_CALL',
          userId: user.id,
          eventProperties: {
            LoginID: `${LoginId}`,
            AccountID: `${defaultAccount.id}`
          }
        })
        const {
          RequestId,
          HttpStatusCode: authHttpStatusCode,
          FlinksCode: authFlinksCode
        } = await request.post({
          uri: `${process.env.flinksURL}/Authorize`,
          body: { LoginId, MostRecentCached: true },
          json: true
        })
        amplitude.track({
          eventType: 'FLINKS_AUTHORIZE_RETURN',
          userId: user.id,
          eventProperties: {
            LoginID: `${LoginId}`,
            HttpStatusCode: authHttpStatusCode,
            FlinksCode: authFlinksCode
          }
        })

        let balance = 0
        if (authHttpStatusCode === 200) {
          const getAccountsDetailBody = {
            RequestId,
            WithAccountIdentity: true,
            WithTransactions: true,
            AccountsFilter: [defaultAccount.token]
          }

          const lastTransaction = await Transaction.findOne({
            order: [['date', 'DESC']],
            where: { accountID: defaultAccount.id }
          })
          if (lastTransaction) {
            getAccountsDetailBody.LastRefresh = [
              {
                AccountId: defaultAccount.id,
                TransactionId: lastTransaction.token
              }
            ]
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
          const {
            Accounts,
            HttpStatusCode: fetchHttpStatusCode,
            FlinksCode: fetchFlinksCode
          } = await request.post({
            uri: `${process.env.flinksURL}/GetAccountsDetail`,
            body: getAccountsDetailBody,
            json: true
          })
          amplitude.track({
            eventType: 'FLINKS_GET_ACCOUNTS_RETURN',
            userId: user.id,
            eventProperties: {
              HttpStatusCode: fetchHttpStatusCode,
              FlinksCode: fetchFlinksCode,
              AccounsCount: `${Accounts ? Accounts.length : 0}`
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

              if (accountToken === defaultAccount.token) {
                balance = accountBalance
              }

              const storedAccount = await Account.findOne({
                where: { token: accountToken }
              })

              if (!storedAccount.transit || !storedAccount.fullName) {
                await storedAccount.update(
                  { fullName, institution, number, transit },
                  { where: { token: accountToken } }
                )
              }

              transactions = transactions
                .reverse()
                .map(
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

              await Bluebird.all(
                transactions.map(item =>
                  Transaction.findOrCreate({
                    where: { token: item.token },
                    defaults: item
                  })
                )
              )
            }
          }
        }
        ctx.body = { data: { balance: parseInt(balance * 100) } }
      } catch (err) {
        Sentry.captureException(err)

        const { error, options } = err
        user.unlink({ error, options })

        ctx.body = { error: true }
      }
    }
  }
})
