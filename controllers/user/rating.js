module.exports = (
  Bluebird,
  User,
  Institution,
  Connection,
  Account,
  Goal,
  Company,
  moment
) => ({
  submit: {
    schema: [['data', true, [['rating', true, 'integer']]]],
    async method (ctx) {
      const {
        data: { rating }
      } = ctx.request.body

      if (rating < 0 || rating > 5) {
        return Bluebird.reject([
          {
            key: 'incorrect_rating',
            value: 'Rating should be in [1, 5] range.'
          }
        ])
      }

      const user = await User.findOne({
        include: [
          { model: Connection, include: [Institution, Account] },
          Goal,
          Company
        ],
        where: { id: ctx.authorized.id }
      })

      if (rating > 0) {
        user.rating = rating
      } else {
        user.noRatingPromptUntil = moment().add(10, 'days')
      }
      await user.save()

      ctx.body = { data: { authorized: user.getData() } }
    }
  }
})
