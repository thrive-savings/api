module.exports = (fs, path, Goal, mixpanel) => ({
  create: {
    schema: [
      ['data', true, [
        ['goal', true, [['description', true], ['image', true]]]
      ]]
    ],
    async method (ctx) {
      const { data: { goal: { description, image } } } = ctx.request.body

      await Goal.create({ description: description, image, userID: ctx.authorized.id })
      const goals = await Goal.findAll({ where: { userID: ctx.authorized.id } })
      let goalDescriptions = []
      goals.map((goal) => {
        goalDescriptions.push(goal.dataValues.description)
      })
      await mixpanel.people.set(ctx.authorized.email, {'Goals': goalDescriptions})

      // const goal = await Goal.create({ description: description, userID: ctx.authorized.id })

      // goal.image = image

      // const matches = image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/)

      // if (matches && matches[2]) {
      //   goal.image = `goals/${goal.id}.jpg`
      //   fs.writeFileSync(`${process.cwd()}/assets/${goal.image}`, matches[2], 'base64')
      // }

      // await goal.save()

      ctx.body = {}
    }
  },
  defaults: {
    async method (ctx) {
      const dir = path.join(process.cwd(), 'assets/goals/default')
      const defaults = fs.readdirSync(dir).map((item) => {
        const [name] = item.split('.')
        return { description: name.split('-').join(' '), image: `goals/default/${item}` }
      })

      ctx.body = { data: { goalSelect: { defaults } } }
    }
  }
})
