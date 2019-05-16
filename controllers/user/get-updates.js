module.exports = (
  User,
  Institution,
  Connection,
  Account,
  Goal,
  Bonus,
  Company,
  MomentumOffer
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

    const momentumOffer = await MomentumOffer.findOne({
      where: { userID: user.id }
    })
    if (momentumOffer) {
      authorizedData.momentumOfferData = momentumOffer.getData()
    }

    ctx.body = { data: { authorized: authorizedData } }
  }
})
