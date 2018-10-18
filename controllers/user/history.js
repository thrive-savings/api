module.exports = (Sequelize, User, Queue, moment) => ({
  fetch: {
    schema: [['data', true, [['fromDate', true]]]],
    async method (ctx) {
      const {
        data: { fromDate: providedFromDate }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: ctx.authorized.id } })

      let fromDate =
        providedFromDate === '-1'
          ? moment().subtract(100, 'years')
          : moment(providedFromDate)
      let history = []

      const queues = await Queue.findAll({
        where: {
          processed: true,
          state: 'completed',
          userID: ctx.authorized.id,
          createdAt: {
            [Sequelize.Op.gt]: fromDate
          }
        },
        order: [['id', 'DESC']]
      })

      let balance = user.balance
      if (queues) {
        queues.map(({ type, amount, processedDate }) => {
          const momentDate = moment(processedDate)

          history.push({
            processedDate,
            date: momentDate.format('YYYY-MM-DD'),
            activity: { type, amount },
            total: balance
          })

          if (type === 'credit') {
            balance += amount
          } else {
            balance -= amount
          }
        })
      }

      ctx.body = { data: { chart: [], history } }
    }
  }
})
