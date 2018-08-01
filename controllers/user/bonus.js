module.exports = (Bluebird, moment, User, Bonus, Account, Goal, Company) => ({
  notificationSeen: {
    async method (ctx) {
      await Bonus.update({ notificationSeenDate: moment() }, { where: { userID: ctx.authorized.id } })

      const user = await User.findOne({ include: [Account, Goal, Company], where: { id: ctx.authorized.id } })
      const authorizedData = user.getAuthorized()
      authorizedData.notifications.bonus = 0

      ctx.body = { data: { authorized: authorizedData } }
    }
  }
})
