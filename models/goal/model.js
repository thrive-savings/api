module.exports = (Bluebird, Sequelize, Queue, request, config) => ({
  attributes: {
    description: {
      type: Sequelize.STRING
    },
    image: {
      type: Sequelize.TEXT
    },
    category: {
      type: Sequelize.STRING
    },
    name: {
      type: Sequelize.STRING
    },
    amount: {
      type: Sequelize.INTEGER,
      defaultValue: 50000
    },
    boosted: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    progress: {
      type: Sequelize.INTEGER,
      defaultValue: 0
    },
    weeksLeft: {
      type: Sequelize.INTEGER,
      field: 'weeks_left'
    },
    createdAt: {
      type: Sequelize.DATE,
      field: 'created_at'
    }
  },
  classMethods: {
    async distributeAmount (
      amountToDistribute,
      userID,
      noCompletionCheck = false
    ) {
      const whereClause = { userID }
      if (amountToDistribute > 0 && !noCompletionCheck) {
        whereClause.progress = { [Sequelize.Op.lt]: Sequelize.col('amount') }
      } else if (amountToDistribute < 0) {
        whereClause.progress = { [Sequelize.Op.gt]: 0 }
      }
      const goals = await this.findAll({
        where: whereClause
      })

      let lastDebitAmount = 0
      const lastDebit = await Queue.findOne({
        where: { processed: true, type: 'debit', state: 'completed', userID },
        order: [['processedDate', 'DESC']]
      })
      if (lastDebit) {
        lastDebitAmount = lastDebit.amount
      }

      let amountLeftToDistribute = amountToDistribute

      if (amountToDistribute > 0) {
        // Debit case
        let totalPortionCount = 0
        const goalPortions = goals.map(({ id, boosted, amount, progress }) => {
          const portion = boosted ? 2 : 1
          totalPortionCount += portion
          return { id, portion, amount, progress }
        })

        let breakAfterUpdate = false
        for (const { id, portion, amount, progress } of goalPortions) {
          const curGoal = await this.findOne({ where: { id } })

          const goalLeftover = amount - progress
          let progressDelta = Math.round(
            amountToDistribute * (portion / totalPortionCount)
          )
          if (goalLeftover < progressDelta && !noCompletionCheck) {
            progressDelta = goalLeftover
            breakAfterUpdate = true
          }
          amountLeftToDistribute -= progressDelta

          const newProgress = progress + progressDelta
          const newLeftOver = amount - newProgress
          const lastDebitPortion = Math.round(
            lastDebitAmount * (portion / totalPortionCount)
          )
          const newWeeksLeft =
            lastDebitPortion <= 0
              ? -1
              : Math.ceil(newLeftOver / lastDebitPortion)

          curGoal.progress = newProgress
          curGoal.weeksLeft = newWeeksLeft
          await curGoal.save()

          if (curGoal.progress >= curGoal.amount) {
            // Send push notification
            request.post({
              uri: `${config.constants.URL}/admin/notifications-push`,
              body: {
                secret: process.env.apiSecret,
                data: {
                  userIds: [userID],
                  message: {
                    title: 'Reached a goal',
                    body: `Hooray! You have reached your '${
                      curGoal.name
                    }' goal`,
                    data: { event: 'goal_completion', data: { id } }
                  }
                }
              },
              json: true
            })
          }

          if (breakAfterUpdate) {
            break
          }
        }

        if (breakAfterUpdate) {
          await this.distributeAmount(
            amountLeftToDistribute,
            userID,
            amountLeftToDistribute === amountToDistribute
          )
        }
      } else if (amountToDistribute < 0) {
        // Credit case
        let totalPortionCount = 0
        const goalPortions = goals.map(({ id, amount, progress }) => {
          const portion = 1
          totalPortionCount += portion
          return { id, portion, amount, progress }
        })

        const amountToDistributeAbs = Math.abs(amountToDistribute)

        let breakAfterUpdate = false
        for (const { id, portion, amount, progress } of goalPortions) {
          let progressDelta = Math.round(
            amountToDistributeAbs * (portion / totalPortionCount)
          )
          if (progress < progressDelta) {
            progressDelta = progress
            breakAfterUpdate = true
          }
          amountLeftToDistribute += progressDelta

          const newProgress = progress - progressDelta
          const newLeftOver = amount - newProgress
          const lastDebitPortion = Math.round(
            lastDebitAmount * (portion / totalPortionCount)
          )
          const newWeeksLeft =
            lastDebitPortion <= 0
              ? -1
              : Math.ceil(newLeftOver / lastDebitPortion)

          await this.update(
            { progress: newProgress, weeksLeft: newWeeksLeft },
            { where: { id } }
          )
          if (breakAfterUpdate) {
            break
          }
        }

        if (breakAfterUpdate) {
          await this.distributeAmount(amountLeftToDistribute, userID)
        }
      }
    },

    async adjustOtherGoalPercentages (
      userID,
      goalID,
      newPercentage,
      isDelete = false
    ) {
      const goals = await this.findAll({
        where: { id: { $ne: goalID }, userID: userID }
      })
      let goalIdPercPairs = goals.map(({ id, percentage }) => ({
        id,
        percentage
      }))
      const goalsCount = goalIdPercPairs.length
      let i = newPercentage
      let j = 0
      while (i > 0) {
        let curPerc = goalIdPercPairs[j].percentage
        if (curPerc === 1) {
          j = j >= goalsCount - 1 ? 0 : j + 1
          continue
        }
        curPerc = isDelete ? curPerc + 1 : curPerc - 1
        goalIdPercPairs[j].percentage = curPerc
        j = j >= goalsCount - 1 ? 0 : j + 1
        i -= 1
      }

      if (newPercentage > 0) {
        await Bluebird.all(
          goalIdPercPairs.map(({ id, percentage }) =>
            this.update({ percentage }, { where: { id } })
          )
        )
      }
    }
  },
  instanceMethods: {
    getData () {
      const {
        id,
        category,
        name,
        amount,
        progress,
        weeksLeft,
        boosted,
        userID
      } = this.dataValues

      return {
        id,
        category,
        name,
        amount,
        progress,
        weeksLeft,
        boosted,
        userID
      }
    }
  },
  associations: {
    belongsTo: 'User'
  },
  indexes: [{ fields: ['user_id'] }],
  timestamps: true,
  desiredDate: false,
  updatedAt: false
})
