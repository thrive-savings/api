module.exports = (Bluebird, Sequelize) => ({
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
      defaultValue: 500000
    },
    percentage: {
      type: Sequelize.INTEGER,
      defaultValue: 50
    },
    desiredDate: {
      type: Sequelize.DATE,
      allowNull: true,
      field: 'desired_date'
    },
    createdAt: {
      type: Sequelize.DATE,
      field: 'created_at'
    }
  },
  associations: {
    belongsTo: 'User'
  },
  classMethods: {
    async adjustOtherGoalPercentages (userID, goalID, newPercentage, isDelete = false) {
      console.log(`----ADJUSTING PERCENTAGES----- ${goalID}, ${newPercentage}, ${isDelete}`)
      const goals = await this.findAll({ where: { id: { $ne: goalID }, userID: userID } })
      let goalIdPercPairs = goals.map(({ id, percentage }) => ({ id, percentage }))
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
        await Bluebird.all(goalIdPercPairs.map(({id, percentage}) => this.update({ percentage }, { where: { id } })))
      }
    }
  },
  indexes: [
    { fields: ['user_id'] }
  ],
  timestamps: true,
  desiredDate: false,
  updatedAt: false
})
