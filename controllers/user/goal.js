module.exports = (fs, path, Sequelize, moment, User, Goal, amplitude) => ({
  create: {
    schema: [
      ['data', true, [['goal', true, [['description', true], ['image', true]]]]]
    ],
    async method (ctx) {
      const {
        data: {
          goal: { description, image }
        }
      } = ctx.request.body

      await Goal.create({
        description: description,
        image,
        userID: ctx.authorized.id
      })
      const goals = await Goal.findAll({ where: { userID: ctx.authorized.id } })
      let goalDescriptions = []
      goals.map(goal => {
        goalDescriptions.push(goal.dataValues.description)
      })

      ctx.body = {}
    }
  },
  defaults: {
    async method (ctx) {
      const dir = path.join(process.cwd(), 'assets/goals/default')
      const defaults = fs.readdirSync(dir).map(item => {
        const [name] = item.split('.')
        return {
          description: name.split('-').join(' '),
          image: `goals/default/${item}`
        }
      })

      ctx.body = { data: { goalSelect: { defaults } } }
    }
  },
  fetchAll: {
    async method (ctx) {
      const goals = await Goal.findAll({
        where: { userID: ctx.authorized.id },
        order: Sequelize.col('id')
      })
      const user = await User.findOne({ where: { id: ctx.authorized.id } })
      const savedAmount = Math.round(user.balance / goals.length)
      ctx.body = {
        data: {
          goals: goals.map(({ id, category, name, amount, userID }) => ({
            id,
            category,
            name,
            amount,
            savedAmount,
            userID
          }))
        }
      }
    }
  },
  add: {
    schema: [
      ['data', true, [['category', true], ['name', true], ['amount', true]]]
    ],
    async method (ctx) {
      const {
        data: { category, name, amount }
      } = ctx.request.body

      await Goal.create({
        category,
        name,
        amount,
        userID: ctx.authorized.id
      })

      const goals = await Goal.findAll({
        where: { userID: ctx.authorized.id },
        order: Sequelize.col('id')
      })
      const user = await User.findOne({ where: { id: ctx.authorized.id } })

      // Onboarding process done
      await user.update({ onboardingStep: 'Done' })

      amplitude.track({
        eventType: 'GOAL_ADDED',
        userId: user.id,
        userProperties: {
          Goals: goals.length
        }
      })

      const savedAmount = Math.round(user.balance / goals.length)
      ctx.body = {
        data: {
          goals: goals.map(({ id, category, name, amount, userID }) => ({
            id,
            category,
            name,
            amount,
            savedAmount,
            userID
          }))
        }
      }
    }
  },
  update: {
    schema: [
      [
        'data',
        true,
        [['category', true], ['id', true], ['name', true], ['amount', true]]
      ]
    ],
    async method (ctx) {
      const {
        data: { category, id, name, amount }
      } = ctx.request.body

      await Goal.update(
        {
          category,
          name,
          amount
        },
        { where: { id, userID: ctx.authorized.id } }
      )

      const user = await User.findOne({ where: { id: ctx.authorized.id } })

      const goals = await Goal.findAll({
        where: { userID: ctx.authorized.id },
        order: Sequelize.col('id')
      })
      amplitude.track({
        eventType: 'GOAL_UPDATED',
        userId: user.id,
        userProperties: {
          Goals: goals.length
        }
      })

      const savedAmount = Math.round(user.balance / goals.length)
      ctx.body = {
        data: {
          goals: goals.map(({ id, category, name, amount, userID }) => ({
            id,
            category,
            name,
            amount,
            savedAmount,
            userID
          }))
        }
      }
    }
  },
  delete: {
    schema: [['data', true, [['goalID', true]]]],
    async method (ctx) {
      const {
        data: { goalID: id }
      } = ctx.request.body

      await Goal.destroy({ where: { id, userID: ctx.authorized.id } })

      const user = await User.findOne({ where: { id: ctx.authorized.id } })

      const goals = await Goal.findAll({
        where: { userID: ctx.authorized.id },
        order: Sequelize.col('id')
      })
      amplitude.track({
        eventType: 'GOAL_DELETED',
        userId: user.id,
        userProperties: {
          Goals: goals.length
        }
      })

      const savedAmount = Math.round(user.balance / goals.length)
      ctx.body = {
        data: {
          goals: goals.map(({ id, category, name, amount, userID }) => ({
            id,
            category,
            name,
            amount,
            savedAmount,
            userID
          }))
        }
      }
    }
  }
})
