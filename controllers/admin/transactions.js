module.exports = (
  User,
  Connection,
  Account,
  Transaction,
  moment,
  Bluebird,
  request,
  config
) => ({
  fetchInterval: {
    schema: [[['end'], ['userIDs', 'array'], ['start']]],
    async method (ctx) {
      const { end, start, userIDs } = ctx.request.body
      const query = { include: [{ model: Account }], where: {} }
      if (end) query.where.date = { $lte: moment(end).toDate() }
      if (start) {
        query.where.date = Object.assign({}, query.where.date, {
          $gte: moment(start).toDate()
        })
      }
      if (userIDs) {
        query.include = [
          { model: Account, where: { userID: [].concat(userIDs) } }
        ]
      }

      const transactions = await Transaction.findAll(query)

      ctx.body = {
        data: {
          transactions: transactions.map(({ dataValues, account }) =>
            Object.assign({}, dataValues, { account })
          )
        }
      }
    }
  },

  fetchUser: {
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

      await request.post({
        uri: `${config.constants.URL}/admin/quovo-fetch-transactions`,
        body: {
          secret: process.env.apiSecret,
          data: {
            quovoUserID: user.quovoUserID
          }
        },
        json: true
      })
    }
  }
})
