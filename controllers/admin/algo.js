module.exports = (
  Sequelize,
  User,
  Connection,
  Account,
  Transaction,
  moment,
  amplitude
) => ({
  run: {
    schema: [
      [
        'data',
        true,
        [
          ['userID', true, 'integer'],
          ['connectionID', true, 'integer'],
          ['accountID', true, 'integer']
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { userID, connectionID, accountID }
      } = ctx.request.body

      const MAX_DS_CONTRIBUTION = 5000
      const MIN_AMOUNT_TO_RUN_SIMPLER = 500

      const reply = {}

      try {
        const user = await User.findOne({ where: { id: userID } })
        const connection = await Connection.findOne({
          where: { id: connectionID }
        })
        const account = await Account.findOne({ where: { id: accountID } })

        if (user && connection && account) {
          let amount = 0

          const transactions = await Transaction.findAll({
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

          const hasTransactions = transactions && transactions.length > 0
          let runSimpler = !hasTransactions

          if (hasTransactions) {
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
                  dsCount: 0
                }
              }

              if (curAmount < MAX_DS_CONTRIBUTION) {
                spendingsPerDay[momentDate].ds += curAmount
                spendingsPerDay[momentDate].dsCount += 1
              }
            })

            const numOfDays = Object.keys(spendingsPerDay).length

            let dsAvg = 0
            if (numOfDays > 0) {
              let dsSum = 0
              Object.keys(spendingsPerDay).forEach(day => {
                const { ds, dsCount } = spendingsPerDay[day]
                dsSum += dsCount ? Math.floor(ds / dsCount) : 0
              })

              dsAvg = Math.floor(dsSum / numOfDays)
            }

            amount = Math.floor(dsAvg * (user.algoBoost / 100))
            if (!amount || amount < MIN_AMOUNT_TO_RUN_SIMPLER) {
              runSimpler = true
            }
          }

          if (runSimpler) {
            const MAX_RAND_BOUND = 2000
            const MIN_RAND_BOUND = 500

            const randomAmount =
              Math.floor(
                Math.random() * (MAX_RAND_BOUND - MIN_RAND_BOUND + 1)
              ) + MIN_RAND_BOUND
            amount = Math.floor(randomAmount * (user.algoBoost / 100))
          }

          reply.amount = amount
          amplitude.track({
            eventType: 'ALGO_RAN',
            userId: user.id,
            eventProperties: {
              connectionID,
              accountID,
              amount,
              algoVersion: runSimpler ? 'simpler' : 'original'
            }
          })
        } else {
          reply.error = true
          amplitude.track({
            eventType: 'ALGO_RUN_FAIL',
            userId: userID,
            eventProperties: {
              errorCode: 'not_found',
              connectionID,
              accountID
            }
          })
        }
      } catch (e) {
        reply.error = true
        amplitude.track({
          eventType: 'ALGO_RUN_FAIL',
          userId: userID,
          eventProperties: {
            error: e,
            errorCode: 'try_catched'
          }
        })
      }

      ctx.body = reply
    }
  },

  runOld: {
    schema: [
      ['data', true, [['userID', true, 'integer'], ['accountID', 'integer']]]
    ],
    async method (ctx) {
      const MAX_DS_CONTRIBUTION = 5000
      const MAX_LDS_CONTRIBUTION = 20000

      const {
        data: { userID, accountID: providedAccountID }
      } = ctx.request.body

      const reply = {}
      try {
        const userFindObj = { where: { id: userID } }
        if (!providedAccountID) {
          userFindObj.include = [{ model: Connection, include: [Account] }]
        }

        const user = await User.findOne(userFindObj)
        if (user) {
          let account
          if (providedAccountID) {
            account = await Account.findOne({
              where: { id: providedAccountID, userID }
            })
          } else {
            const { account: primaryAccount } = user.getPrimaryAccount()
            if (primaryAccount) {
              account = primaryAccount
            }
          }

          if (account) {
            const accountBalance = account.getBalance()

            let amount = 0
            let safeBalance = accountBalance

            const transactions = await Transaction.findAll({
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

            if (transactions && transactions.length > 0) {
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

              let dsAvg = 0
              let ldsAvg = 0
              if (numOfDays > 0) {
                let dsSum = 0
                let ldsSum = 0
                Object.keys(spendingsPerDay).forEach(day => {
                  const { ds, dsCount, lds, ldsCount } = spendingsPerDay[day]
                  dsSum += dsCount ? Math.floor(ds / dsCount) : 0
                  ldsSum += ldsCount ? Math.floor(lds / ldsCount) : 0
                })

                dsAvg = Math.floor(dsSum / numOfDays)
                ldsAvg = Math.floor(ldsSum / numOfDays)
              }

              safeBalance = safeBalance - (dsAvg * 7 + ldsAvg * 7)
              amount = Math.floor(dsAvg * (user.algoBoost / 100))

              amplitude.track({
                eventType: 'ALGO_RAN',
                userId: user.id,
                eventProperties: {
                  algoVersion: 'original',
                  accountID: account.id,
                  amountChosen: amount,
                  accountBalance,
                  accountSafeBalance: safeBalance,
                  dailySpendingAvg: dsAvg,
                  largerDailySpendingAvg: ldsAvg
                }
              })
            } else {
              const MAX_RAND_BOUND = 1500
              const MIN_RAND_BOUND = 500

              const randomAmount =
                Math.floor(
                  Math.random() * (MAX_RAND_BOUND - MIN_RAND_BOUND + 1)
                ) + MIN_RAND_BOUND
              amount = Math.floor(randomAmount * (user.algoBoost / 100))

              amplitude.track({
                eventType: 'ALGO_RAN',
                userId: user.id,
                eventProperties: {
                  algoVersion: 'simple',
                  algoVersionReason: 'no_transactions_found',
                  accountID: account.id,
                  amountChosen: amount,
                  accountBalance,
                  accountSafeBalance: safeBalance
                }
              })
            }

            reply.amount = amount
            reply.safeBalance = safeBalance
          } else {
            reply.error = true
            amplitude.track({
              eventType: 'ALGO_RUN_FAIL',
              userId: userID,
              eventProperties: {
                error: `no_account_found`,
                providedAccountID
              }
            })
          }
        } else {
          reply.error = true
          amplitude.track({
            eventType: 'ALGO_RUN_FAIL',
            userId: userID,
            eventProperties: {
              error: `No user ${userID} found`
            }
          })
        }
      } catch (e) {
        reply.error = true
        amplitude.track({
          eventType: 'ALGO_RUN_FAIL',
          userId: userID,
          eventProperties: {
            error: e
          }
        })
      }

      ctx.body = reply
    }
  }
})
