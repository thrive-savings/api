module.exports = (User, Goal) => ({
  schema: [
    ['data', true, [['userID', true, 'integer'], ['amount', true, 'integer']]]
  ],
  async method (ctx) {
    const {
      data: { userID, amount: providedAmount }
    } = ctx.request.body

    let amount = providedAmount
    const user = await User.findOne({ where: { id: userID } })
    if (amount < 0) {
      if (Math.abs(amount) > user.balance) {
        amount = -1 * user.balance
      }
    }
    user.balance += amount
    await user.save()
    await Goal.distributeAmount(amount, userID)

    ctx.body = { data: { amount, userID: user.id } }
  }
})
