module.exports = (
  fs,
  path,
  Sequelize,
  Bluebird,
  User,
  Goal,
  config,
  request,
  amplitude
) => ({
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
      ctx.body = {
        data: {
          goals: goals.map(
            ({
              id,
              category,
              name,
              amount,
              progress,
              weeksLeft,
              boosted,
              userID
            }) => ({
              id,
              category,
              name,
              amount,
              progress,
              weeksLeft,
              boosted,
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
          ['boosted', true, 'boolean']
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { category, name, amount, boosted }
      } = ctx.request.body

      await Goal.create({
        category,
        name,
        amount,
        boosted,
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
        },
        eventProperties: {
          Category: category
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
              progress,
              weeksLeft,
              boosted,
              userID
            }) => ({
              id,
              category,
              name,
              amount,
              progress,
              weeksLeft,
              boosted,
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
          ['boosted', true, 'boolean']
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { category, id, name, amount, boosted }
      } = ctx.request.body

      await Goal.update(
        {
          category,
          name,
          amount,
          boosted
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
        },
        eventProperties: {
          Category: category
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
              progress,
              weeksLeft,
              boosted,
              userID
            }) => ({
              id,
              category,
              name,
              amount,
              progress,
              weeksLeft,
              boosted,
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

      const goal = await Goal.findOne({
        where: { id, userID: ctx.authorized.id }
      })
      if (!goal) {
        return Bluebird.reject([{ key: 'goal', value: 'Goal not found' }])
      }

      const category = goal.category
      const progress = goal.progress
      await Goal.destroy({ where: { id: goal.id } })
      await Goal.distributeAmount(progress, ctx.authorized.id)

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
        },
        eventProperties: {
          Category: category
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
              progress,
              weeksLeft,
              boosted,
              userID
            }) => ({
              id,
              category,
              name,
              amount,
              progress,
              weeksLeft,
              boosted,
              userID
            })
          )
        }
      }
    }
  },
  withdraw: {
    schema: [['data', true, [['goalID', true]]]],
    async method (ctx) {
      const {
        data: { goalID: id }
      } = ctx.request.body

      const goal = await Goal.findOne({
        where: { id, userID: ctx.authorized.id }
      })
      if (!goal) {
        return Bluebird.reject([{ key: 'goal', value: 'Goal not found' }])
      }

      await request.post({
        uri: `${config.constants.URL}/admin/worker-transfer`,
        body: {
          secret: process.env.apiSecret,
          data: {
            userID: goal.userID,
            amount: goal.progress,
            type: 'credit',
            requestMethod: 'InAppRequest'
          }
        },
        json: true
      })

      const category = goal.category
      const progress = goal.progress
      await Goal.destroy({ where: { id: goal.id } })
      await Goal.distributeAmount(progress, ctx.authorized.id)

      const user = await User.findOne({ where: { id: ctx.authorized.id } })

      const goals = await Goal.findAll({
        where: { userID: ctx.authorized.id },
        order: Sequelize.col('id')
      })
      amplitude.track({
        eventType: 'GOAL_WITHDRAW_REQUESTED',
        userId: user.id,
        userProperties: {
          Goals: goals.length
        },
        eventProperties: {
          Category: category
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
              progress,
              weeksLeft,
              boosted,
              userID
            }) => ({
              id,
              category,
              name,
              amount,
              progress,
              weeksLeft,
              boosted,
              userID
            })
          )
        }
      }
    }
  }
})
