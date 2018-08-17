module.exports = (
  User,
  Account,
  Transaction,
  moment,
  request,
  Bluebird,
  amplitude
) => ({
  run: {
    schema: [['data', true, [['userID', true, 'integer']]]],
    async method (ctx) {
      const MAX_DEBIT_CONTRIBUTION = 10000

      const {
        data: { userID }
      } = ctx.request.body
      const user = await User.findOne({
        include: [{ model: Account, include: [Transaction] }],
        where: { id: userID }
      })

      let account
      if (user.accounts) {
        account = user.accounts.filter(item => !!item.isDefault)[0]
      } else {
        account = await Account.findOne({
          include: [Transaction],
          where: { userID, isDefault: true }
        })
      }

      let transactions
      if (account.transactions) {
        transactions = account.transactions
      } else {
        transactions = await Transaction.findAll({
          where: { accountID: account.id, userID }
        })
      }

      let amount = 0
      if (transactions) {
        const lastMonth = moment().subtract(1, 'months')

        let closestDate = lastMonth
        let latestBalance = 0

        let debitSum = 0
        let debitCount = 0
        for (const { date, balance, amount, type } of transactions) {
          const momentDate = moment(date)
          if (momentDate > closestDate) {
            latestBalance = balance
            closestDate = momentDate
          }
          if (
            momentDate > lastMonth &&
            type === 'debit' &&
            amount < MAX_DEBIT_CONTRIBUTION
          ) {
            debitSum += amount
            debitCount += 1
          }
        }

        amount = Math.floor(debitSum / debitCount) / 2
        if (latestBalance > amount * 800) amount *= 2.5
        else if (latestBalance > amount * 400) amount *= 2
        else if (latestBalance > amount * 200) amount *= 1.5
        else if (latestBalance > amount * 100) {
          amount = Math.floor(amount * 1.25)
        } else if (latestBalance > amount * 50) { amount = Math.floor(amount * 1.1) }

        amplitude.track({
          eventType: 'ALGO_RAN',
          userId: user.id,
          eventProperties: {
            AccountID: `${account.id}`,
            Amount: `${amount}`,
            DebitSum: `${debitSum}`,
            DebitCount: `${debitCount}`,
            Balance: `${latestBalance}`
          }
        })
      }

      ctx.body = { amount }
    },
    onError (error) {
      amplitude.track({
        eventType: 'ALGO_RUN_FAIL',
        userId: 'server',
        eventProperties: { error }
      })
    }
  }
})
