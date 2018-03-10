module.exports = (Account, moment, Transaction) => ({
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
})
