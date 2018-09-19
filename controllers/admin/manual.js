module.exports = (Sequelize, User) => ({
  unlink: {
    schema: [['data', true, [['userIds', true, 'array']]]],
    async method (ctx) {
      const {
        data: { userIds }
      } = ctx.request.body

      const users = await User.findAll({
        where: { id: { [Sequelize.Op.in]: userIds } }
      })

      for (const user of users) {
        user.unlink()
      }

      ctx.body = {}
    }
  }
})
