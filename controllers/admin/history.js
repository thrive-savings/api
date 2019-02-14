module.exports = (Sequelize, User, Queue, moment) => ({
  fetch: {
    schema: [['data', true, [['userID', true, 'integer'], ['fromDate', true]]]],
    async method (ctx) {
      const {
        data: { userID, fromDate: providedFromDate }
      } = ctx.request.body

      const getDollarString = (amount, rounded = false) => {
        let amountInDollars = amount / 100
        amountInDollars = !rounded
          ? amountInDollars.toFixed(2)
          : amountInDollars.toFixed(0)
        amountInDollars =
          '$' +
          amountInDollars.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD'
          })

        return amountInDollars
      }

      const user = await User.findOne({ where: { id: userID } })

      let fromDate =
        providedFromDate === '-1'
          ? moment().subtract(100, 'years')
          : moment(providedFromDate)
      let history = []

      const queues = await Queue.findAll({
        where: {
          processed: true,
          state: 'completed',
          userID,
          createdAt: {
            [Sequelize.Op.gt]: fromDate
          }
        },
        order: [['id', 'DESC']]
      })

      let totalSavings = 0
      let balance = user.balance
      if (queues) {
        queues.map(({ type, amount, processedDate }) => {
          if (type !== 'credit') {
            totalSavings += amount
          }

          const momentDate = moment(processedDate)

          history.push({
            processedDate,
            date: momentDate.format('YYYY-MM-DD'),
            dateMonthOnly: momentDate.format('MM/DD'),
            activity: {
              type,
              typeToDisplay:
                type === 'credit'
                  ? 'Withdrawal'
                  : type === 'bonus'
                    ? 'Employer Bonus'
                    : 'Deposit',
              color:
                type === 'credit'
                  ? '#A12938'
                  : type === 'bonus'
                    ? '#2CC197'
                    : '#0089CB',
              amount,
              amountInDollars:
                (type === 'credit' ? '-' : '') + getDollarString(amount)
            },
            total: balance,
            totalInDollars: getDollarString(balance)
          })

          if (type === 'credit') {
            balance += amount
          } else {
            balance -= amount
          }
        })
      }

      ctx.body = {
        history,
        totalSavings,
        totalSavingsInDollars: getDollarString(totalSavings),
        balanceInDollars: getDollarString(user.balance)
      }
    }
  }
})
