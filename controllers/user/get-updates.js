module.exports = (User, Connection, Goal, Bonus, Company) => ({
  async method (ctx) {
    const user = await User.findOne({
      include: [Connection, Goal, Company],
      where: { id: ctx.authorized.id }
    })

    const authorizedData = user.getAuthorized()

    const bonuses = await Bonus.findAll({
      where: {
        userID: user.id,
        companyID: user.companyID,
        notificationSeenDate: null
      }
    })
    let totalBonus = 0
    bonuses.forEach(({ amount }) => {
      totalBonus += amount
    })

    authorizedData.notifications.bonus = totalBonus

    ctx.body = { data: { authorized: authorizedData } }
  }
})
