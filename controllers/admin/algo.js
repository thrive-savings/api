module.exports = (
  Sequelize,
  User,
  Account,
  Transaction,
  moment,
  Bluebird,
  amplitude,
  Sentry
) => ({
  run: {
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

        console.log(`Runnning Algo for user ${userID}, account ${account.id}`)

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
        let safeBalance = account.value
        if (transactions) {
          const spendingsPerDay = {}

          transactions.forEach(({ date, value, subtype }) => {
            if (subtype !== 'WITH') {
              return
            }

            const curAmount = -1 * value

            const momentDate = moment(date).format('dddd, MMMM Do YYYY')
            if (!Object.keys(spendingsPerDay).includes(momentDate)) {
              spendingsPerDay[momentDate] = {
                ds: 0,
                dsCount: 0,
                lds: 0,
                ldsCount: 0
              }
            }

            if (curAmount < MAX_DS_CONTRIBUTION) {
              spendingsPerDay[momentDate].ds += curAmount
              spendingsPerDay[momentDate].dsCount += 1
            } else if (curAmount < MAX_LDS_CONTRIBUTION) {
              spendingsPerDay[momentDate].lds += curAmount
              spendingsPerDay[momentDate].ldsCount += 1
            }
          })

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

          safeBalance = safeBalance - (dsAvg * 7 + ldsAvg * 7)

          amount = Math.floor(dsAvg * (user.algoBoost / 100))

          console.log(`----Algo ran----`)
          console.log({
            dsSum,
            ldsSum,
            numOfDays,
            dsAvg,
            ldsAvg
          })

          amplitude.track({
            eventType: 'ALGO_RAN',
            userId: user.id,
            eventProperties: {
              AccountID: `${account.id}`,
              Amount: `${amount}`,
              DailySpendingAvg: `${dsAvg}`,
              LargerDailySpendingAvg: `${ldsAvg}`,
              Balance: `${account.value}`,
              SafeBalance: `${safeBalance}`
            }
          })
        }

        ctx.body = { amount, safeBalance }
      } catch (error) {
        Sentry.captureException(error)

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
