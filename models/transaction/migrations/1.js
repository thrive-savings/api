module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .createTable('transactions', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          field: 'id'
        },
        amount: {
          type: Sequelize.INTEGER,
          field: 'amount'
        },
        balance: {
          type: Sequelize.INTEGER,
          field: 'balance'
        },
        date: {
          type: Sequelize.DATE,
          field: 'date'
        },
        description: {
          type: Sequelize.STRING,
          field: 'description'
        },
        token: {
          type: Sequelize.STRING,
          field: 'token'
        },
        type: {
          type: Sequelize.STRING,
          field: 'type'
        },
        accountID: {
          type: Sequelize.INTEGER,
          allowNull: false,
          field: 'account_id',
          references: {
            model: 'accounts',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        }
      })
      .then(() => queryInterface.addIndex('transactions', ['account_id']))
  },
  down (queryInterface) {
    return queryInterface
      .dropTable('transactions')
      .then(() => queryInterface.removeIndex('transactions', ['account_id']))
  }
})
