module.exports = (
  User,
  Institution,
  Connection,
  Account,
  SynapseEntry,
  SynapseNode,
  Goal,
  Bonus,
  Company,
  MomentumOffer
) => ({
  async method (ctx) {
    const user = await User.findOne({
      include: [
        { model: Connection, include: [Institution, Account] },
        SynapseEntry,
        SynapseNode,
        MomentumOffer,
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

    console.log(authorizedData)

    ctx.body = { data: { authorized: authorizedData } }
  }
})
