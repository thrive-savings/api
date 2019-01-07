module.exports = (
  User,
  Institution,
  Connection,
  Account,
  Goal,
  Bonus,
  Company
) => ({
  async method (ctx) {
    const user = await User.findOne({
      include: [
        { model: Connection, include: [Institution, Account] },
        Goal,
        Company
      ],
      where: { id: ctx.authorized.id }
    })

    const authorizedData = user.getData()

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
