module.exports = (User, Account, Transaction, moment, request, Bluebird) => ({
  run: {
    schema: [['data', true, [['userID', true, 'integer']]]],
    async method (ctx) {
      const values = [3564, 3025, 2516, 4535, 2268, 5050, 2015, 3030, 4045, 3815, 3665, 3225, 2235, 2645, 2785]
      const amount = values[Math.floor(Math.random() * values.length)]
      ctx.body = { amount }
    }
  }
})
