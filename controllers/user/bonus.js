module.exports = (
  moment,
  User,
  Institution,
  Bonus,
  Connection,
  Account,
  Goal,
  Company
) => ({
  notificationSeen: {
    async method (ctx) {
      await Bonus.update(
        { notificationSeenDate: moment() },
        { where: { userID: ctx.authorized.id } }
      )

      const user = await User.findOne({
        include: [
          { model: Connection, include: [Institution, Account] },
          Goal,
          Company
        ],
        where: { id: ctx.authorized.id }
      })
      const authorizedData = user.getData()
      authorizedData.notifications.bonus = 0

      ctx.body = { data: { authorized: authorizedData } }
    }
  }
})
