module.exports = (Sequelize, User, Transfer, config, moment) => ({
  fetch: {
    schema: [['data', true, [['userID', true, 'integer'], ['fromDate', true]]]],
    async method (ctx) {
      const {
        data: { userID, fromDate: providedFromDate }
      } = ctx.request.body

      const {
        TRANSFER: { TYPES, SUBTYPES, STATES }
      } = config.constants

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

      const reply = { userID }
      try {
        const user = await User.findOne({
          where: { id: userID }
        })
        if (user) {
          let fromDate =
            providedFromDate === '-1'
              ? moment().subtract(100, 'years')
              : moment(providedFromDate)

          let history = []

          const transfers = await Transfer.fetchHistory(userID, {
            state: [STATES.COMPLETED, STATES.PROCESSING],
            fromDate
          })

          let totalSavings = 0
          let balance = user.balance
          if (transfers && transfers.length) {
            transfers.map(({ type, subtype, state, amount, createdAt }) => {
              if (subtype === SUBTYPES.SAVE) {
                totalSavings += amount
              }

              const momentDate = moment(createdAt)
              const entry = {
                withOpacity: state === STATES.PROCESSING,
                processedDate: createdAt,
                date: momentDate.format('YYYY-MM-DD'),
                dateMonthOnly: momentDate.format('MM/DD'),
                total: balance,
                totalInDollars: getDollarString(balance),
                activity: {
                  type,
                  subtype,
                  state,
                  amount,
                  amountInDollars:
                    (type === TYPES.CREDIT ? '-' : '') + getDollarString(amount)
                }
              }

              switch (subtype) {
                case SUBTYPES.SAVE:
                  entry.activity.typeToDisplay = 'Deposit'
                  entry.activity.color = '#0089CB'
                  if (state === STATES.PROCESSING) {
                    entry.activity.typeToDisplay += ' Enroute'
                  }
                  break
                case SUBTYPES.WITHDRAW:
                  entry.activity.typeToDisplay = 'Withdrawal'
                  entry.activity.color = '#A12938'
                  if (state === STATES.PROCESSING) {
                    entry.activity.typeToDisplay += ' Enroute'
                  }
                  break
                case SUBTYPES.MATCH:
                  entry.activity.typeToDisplay = 'Match'
                  entry.activity.color = '#2CC197'
                  break
                case SUBTYPES.REWARD:
                  entry.activity.typeToDisplay = 'Reward'
                  entry.activity.color = '#2CC197'
                  break
              }

              history.push(entry)

              if (type === TYPES.CREDIT) {
                balance += amount
              } else {
                balance -= amount
              }
            })
          }

          reply.history = history
          reply.totalSavings = totalSavings
          reply.totalSavingsInDollars = getDollarString(totalSavings)
          reply.balanceInDollars = getDollarString(user.balance)
        } else {
          reply.error = true
          reply.errorCode = 'user_not_found'
          reply.message = `User not found for ID ${userID}`
        }
      } catch (e) {
        reply.error = true
        reply.errorCode = 'try_catched'
        reply.errorData = e
      }

      ctx.body = reply
    }
  }
})
