module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .createTable('debts', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          field: 'id'
        },

        // Amounts
        amountPulled: {
          type: Sequelize.INTEGER,
          field: 'amount_pulled',
          defaultValue: 0
        },
        amountToPay: {
          type: Sequelize.INTEGER,
          field: 'amount_to_pay',
          defaultValue: 10000
        },
        accelerateAmount: {
          type: Sequelize.INTEGER,
          field: 'accelerate_amount',
          defaultValue: 0
        },

        // General
        status: {
          type: Sequelize.STRING,
          field: 'status',
          defaultValue: 'off'
        },
        type: {
          type: Sequelize.STRING,
          field: 'type',
          defaultValue: 'Credit Card'
        },

        // Refs
        accountID: {
          type: Sequelize.INTEGER,
          allowNull: true,
          field: 'account_id',
          references: {
            model: 'accounts',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
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

        // Dates
        createdAt: {
          type: Sequelize.DATE,
          field: 'created_at'
        },
        updatedAt: {
          type: Sequelize.DATE,
          field: 'updated_at'
        }
      })
      .then(() => queryInterface.addIndex('debts', ['user_id', 'account_id']))
  },
  down (queryInterface) {
    return queryInterface
      .dropTable('debts')
      .then(() =>
        queryInterface.removeIndex('debts', ['user_id', 'account_id'])
      )
  }
})
