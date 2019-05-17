module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .createTable('momentum_offers', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          field: 'id'
        },
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
          values: ['waiting', 'uninterested', 'ineligible', 'passed', 'passed_done', 'ineligible_done'],
          defaultValue: 'waiting',
          field: 'status'
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
      })
      .then(() => queryInterface.addIndex('momentum_offers', ['user_id']))
  },
  down (queryInterface) {
    return queryInterface
      .dropTable('momentum_offers')
      .then(() => queryInterface.removeIndex('momentum_offers', ['user_id']))
  }
})
