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
      ctx.body = {
        data: {
          goals: goals.map(
            ({
              id,
              category,
              name,
              amount,
              percentage,
              desiredDate,
              createdAt,
              userID
            }) => ({
              id,
              category,
              name,
              amount,
              savedAmount: Math.round(user.balance * (percentage / 100)),
              percentage,
              desiredDate,
              createdAt,
              userID
            })
          )
        }
      }
    }
  },
  add: {
    schema: [
      [
        'data',
        true,
        [
          ['category', true],
          ['name', true],
          ['amount', true],
          ['desiredDate', true],
          ['percentage', true]
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { category, name, amount, desiredDate, percentage }
      } = ctx.request.body

      // await Goal.create({ category: 'RainyDay', name: 'Rainy Day Fund', percentage: 100 - percentage, userID: ctx.authorized.id })

      const newGoal = await Goal.create({
        category,
        name,
        amount,
        desiredDate: desiredDate === 'infinite' ? null : moment(desiredDate),
        percentage,
        userID: ctx.authorized.id
      })

      await Goal.adjustOtherGoalPercentages(
        ctx.authorized.id,
        newGoal.id,
        percentage
      )

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

      ctx.body = {
        data: {
          goals: goals.map(
            ({
              id,
              category,
              name,
              amount,
              percentage,
              desiredDate,
              createdAt,
              userID
            }) => ({
              id,
              category,
              name,
              amount,
              savedAmount: Math.round(user.balance * (percentage / 100)),
              percentage,
              desiredDate,
              createdAt,
              userID
            })
          )
        }
      }
    }
  },
  update: {
    schema: [
      [
        'data',
        true,
        [
          ['category', true],
          ['id', true],
          ['name', true],
          ['amount', true],
          ['desiredDate', true],
          ['percentage', true]
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { category, id, name, amount, desiredDate, percentage }
      } = ctx.request.body

      const goal = await Goal.findOne({ where: { id } })
      await Goal.update(
        {
          category,
          name,
          amount,
          desiredDate: desiredDate === 'infinite' ? null : moment(desiredDate),
          percentage
        },
        { where: { id, userID: ctx.authorized.id } }
      )

      await Goal.adjustOtherGoalPercentages(
        ctx.authorized.id,
        goal.id,
        Math.abs(percentage - goal.percentage),
        goal.percentage > percentage
      )

      const goals = await Goal.findAll({
        where: { userID: ctx.authorized.id },
        order: Sequelize.col('id')
      })
      const user = await User.findOne({ where: { id: ctx.authorized.id } })
      amplitude.track({
        eventType: 'GOAL_UPDATED',
        userId: user.id,
        userProperties: {
          Goals: goals.length
        }
      })

      ctx.body = {
        data: {
          goals: goals.map(
            ({
              id,
              category,
              name,
              amount,
              percentage,
              desiredDate,
              createdAt,
              userID
            }) => ({
              id,
              category,
              name,
              amount,
              savedAmount: Math.round(user.balance * (percentage / 100)),
              percentage,
              desiredDate,
              createdAt,
              userID
            })
          )
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

      const deletedGoal = await Goal.findOne({ where: { id } })
      await Goal.destroy({ where: { id, userID: ctx.authorized.id } })

      await Goal.adjustOtherGoalPercentages(
        ctx.authorized.id,
        deletedGoal.id,
        deletedGoal.percentage,
        true
      )

      const goals = await Goal.findAll({
        where: { userID: ctx.authorized.id },
        order: Sequelize.col('id')
      })
      const user = await User.findOne({ where: { id: ctx.authorized.id } })
      amplitude.track({
        eventType: 'GOAL_DELETED',
        userId: user.id,
        userProperties: {
          Goals: goals.length
        }
      })

      ctx.body = {
        data: {
          goals: goals.map(
            ({
              id,
              category,
              name,
              amount,
              percentage,
              desiredDate,
              createdAt,
              userID
            }) => ({
              id,
              category,
              name,
              amount,
              savedAmount: Math.round(user.balance * (percentage / 100)),
              percentage,
              desiredDate,
              createdAt,
              userID
            })
          )
        }
      }
    }
  }
})
