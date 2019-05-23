module.exports = (User, Bonus) => ({
  run: {
    schema: [
      ['data', true, [['userID', true, 'integer'], ['amount', true, 'integer']]]
    ],
    async method (ctx) {
      const {
        data: { userID }
      } = ctx.request.data

      const reply = {}
      try {
        const user = await User.findOne({ where: { id: userID } })
        if (user) {
        } else {
        }
      } catch (e) {}

      ctx.body = reply
    }
  }
})
