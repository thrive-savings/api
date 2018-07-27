module.exports = (Goal) => ({
  schema: [['data', true, [['goalID', true, 'integer']]]],
  async method (ctx) {
    await Goal.destroy({ where: { id: ctx.request.body.data.goalID } })
    const goals = await Goal.findAll({ where: { userID: ctx.authorized.id } })
    let goalDescriptions = []
    goals.map((goal) => {
      goalDescriptions.push(goal.dataValues.description)
    })

    ctx.body = { goals: goals.map((item) => ({ description: item.description, id: item.id, image: item.get('image') })) }
  }
})
