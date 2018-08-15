module.exports = (CompanyAdmin, User, Goal, Bonus) => ({
  data: {
    type: 'get',
    async method (ctx) {
      const companyAdmin = await CompanyAdmin.findOne({
        where: { id: ctx.authorized.id }
      })

      const users = await User.findAll({
        attributes: ['id', 'balance'],
        include: [Goal],
        where: { companyID: companyAdmin.companyID }
      })

      let goalsInfo = {}
      let usersCount = 0
      let totalSaved = 0
      for (const user of users) {
        totalSaved += user.balance
        usersCount += 1

        let goals
        if (user.goals) {
          goals = user.goals
        } else {
          goals = await Goal.findAll({ where: { userID: user.id } })
        }

        for (const { category } of goals) {
          goalsInfo[category] =
            category in goalsInfo && 'count' in goalsInfo[category]
              ? { count: goalsInfo[category].count + 1 }
              : { count: 1 }
        }
      }

      for (const goalCategory of Object.keys(goalsInfo)) {
        const categoryCount = goalsInfo[goalCategory].count
        const categoryPercentage = (categoryCount / usersCount) * 100
        goalsInfo[goalCategory].percentage = Math.round(categoryPercentage)
      }

      const totalContributions = await Bonus.sum('amount', {
        where: { companyID: companyAdmin.companyID }
      })

      ctx.body = {
        data: {
          overview: { usersCount, totalSaved, totalContributions },
          goals: goalsInfo
        }
      }
    }
  }
})
