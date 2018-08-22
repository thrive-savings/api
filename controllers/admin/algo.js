module.exports = (
  Sequelize,
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
      if (!user) {
        return Bluebird.reject([
          { key: 'User', value: `User not found for ID: ${userID}` }
        ])
      }

      try {
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
          } else if (latestBalance > amount * 50) {
            amount = Math.floor(amount * 1.1)
          }

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
      } catch (error) {
        amplitude.track({
          eventType: 'ALGO_RUN_FAIL',
          userId: user.id,
          eventProperties: { error }
        })
        ctx.body = { error: true }
      }
    }
  },

  runNew: {
    schema: [['data', true, [['userID', true, 'integer']]]],
    async method (ctx) {
      const MAX_DS_CONTRIBUTION = 5000
      const MAX_LDS_CONTRIBUTION = 20000

      const {
        data: { userID }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: userID } })
      if (!user) {
        return Bluebird.reject([
          { key: 'User', value: `User not found for ID: ${userID}` }
        ])
      }

      try {
        const account = await Account.findOne({
          where: { userID, isDefault: true }
        })

        let transactions
        if (account) {
          transactions = await Transaction.findAll({
            where: {
              accountID: account.id,
              date: {
                [Sequelize.Op.gt]: moment()
                  .subtract(3, 'months')
                  .toDate()
              }
            },
            order: [['date', 'DESC']]
          })
        }

        let amount = 0
        let safeBalance
        if (transactions) {
          let latestBalance
          const spendingsPerDay = {}

          transactions.forEach(({ date, balance, amount, type }) => {
            if (!latestBalance) {
              latestBalance = balance
            }

            const momentDate = moment(date).format('dddd, MMMM Do YYYY')
            if (!Object.keys(spendingsPerDay).includes(momentDate)) {
              spendingsPerDay[momentDate] = {
                ds: 0,
                dsCount: 0,
                lds: 0,
                ldsCount: 0
              }
            }

            if (amount < MAX_DS_CONTRIBUTION) {
              spendingsPerDay[momentDate].ds += amount
              spendingsPerDay[momentDate].dsCount += 1
            } else if (amount < MAX_LDS_CONTRIBUTION) {
              spendingsPerDay[momentDate].lds += amount
              spendingsPerDay[momentDate].ldsCount += 1
            }
          })
          safeBalance = latestBalance

          const numOfDays = Object.keys(spendingsPerDay).length
          let dsSum = 0
          let ldsSum = 0
          Object.keys(spendingsPerDay).forEach(day => {
            const { ds, dsCount, lds, ldsCount } = spendingsPerDay[day]
            dsSum += dsCount ? Math.floor(ds / dsCount) : 0
            ldsSum += ldsCount ? Math.floor(lds / ldsCount) : 0
          })

          const dsAvg = Math.floor(dsSum / numOfDays)
          const ldsAvg = Math.floor(ldsSum / numOfDays)

          safeBalance = latestBalance - (dsAvg * 7 + ldsAvg * 7)

          amount = dsAvg

          amplitude.track({
            eventType: 'ALGO_RAN',
            userId: user.id,
            eventProperties: {
              AccountID: `${account.id}`,
              Amount: `${amount}`,
              DailySpendingAvg: `${dsAvg}`,
              LargerDailySpendingAvg: `${ldsAvg}`,
              Balance: `${latestBalance}`,
              SafeBalance: `${safeBalance}`
            }
          })
        }

        ctx.body = { amount, safeBalance }
      } catch (error) {
        amplitude.track({
          eventType: 'ALGO_RUN_FAIL',
          userId: user.id,
          eventProperties: { error }
        })

        ctx.body = { error: true }
      }
    }
  }
})
