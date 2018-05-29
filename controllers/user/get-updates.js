module.exports = (User, Account, Goal, Bonus) => ({
  async method (ctx) {
    const user = await User.findOne({ include: [Account, Goal, Bonus], where: { id: ctx.authorized.id } })

    const authorizedData = user.getAuthorized()

    const bonuses = await Bonus.findAll({ where: { userID: user.id, companyID: user.companyID, notificationSeenDate: null } })
    let totalBonus = 0
    bonuses.forEach(({ amount }) => { totalBonus += amount })

    authorizedData.notifications.bonus = totalBonus

    ctx.body = { data: { authorized: authorizedData } }
  }
})
