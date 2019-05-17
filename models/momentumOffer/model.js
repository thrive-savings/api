module.exports = Sequelize => ({
  attributes: {
    householdCount: {
      type: Sequelize.INTEGER,
      field: 'household_count'
    },
    isIncomeBelow: {
      type: Sequelize.BOOLEAN,
      field: 'is_income_below',
      defaultValue: false
    },
    status: {
      type: Sequelize.ENUM,
      values: [
        'waiting',
        'uninterested',
        'ineligible',
        'passed',
        'passed_done',
        'ineligible_done'
      ],
      defaultValue: 'waiting'
    },
    nextBonusDate: {
      type: Sequelize.DATE,
      field: 'next_bonus_date'
    },
    userID: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    createdAt: {
      type: Sequelize.DATE,
      field: 'created_at'
    },
    updatedAt: {
      type: Sequelize.DATE,
      field: 'updated_at'
    }
  },
  associations: {
    belongsTo: 'User'
  },
  instanceMethods: {
    getData () {
      return {
        id: this.id,
        userID: this.userID,
        status: this.status,
        nextBonusDate: this.nextBonusDate
      }
    }
  },
  indexes: [{ fields: ['user_id'] }],
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
})
