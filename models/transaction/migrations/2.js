module.exports = Sequelize => ({
  up (queryInterface) {
    return (
      queryInterface.removeColumn('transactions', 'balance'),
      queryInterface.removeColumn('transactions', 'token'),
      queryInterface.renameColumn('transactions', 'amount', 'value'),
      queryInterface.addColumn('transactions', 'fees', {
        type: Sequelize.INTEGER,
        defaultValue: 0
      }),
      queryInterface.addColumn('transactions', 'category', {
        type: Sequelize.STRING
      }),
      queryInterface.addColumn('transactions', 'subcategory', {
        type: Sequelize.STRING
      }),
      queryInterface.addColumn('transactions', 'type', {
        type: Sequelize.STRING
      }),
      queryInterface.addColumn('transactions', 'subtype', {
        type: Sequelize.STRING
      }),
      queryInterface.addColumn('transactions', 'is_cancel', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }),
      queryInterface.addColumn('transactions', 'is_pending', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }),
      queryInterface.addColumn('transactions', 'quovo_transaction_id', {
        type: Sequelize.INTEGER,
        allowNull: false
      }),
      queryInterface.addColumn('transactions', 'quovo_account_id', {
        type: Sequelize.INTEGER,
        allowNull: false
      }),
      queryInterface.addColumn('transactions', 'quovo_connection_id', {
        type: Sequelize.INTEGER,
        allowNull: false
      }),
      queryInterface.addColumn('transactions', 'quovo_user_id', {
        type: Sequelize.INTEGER,
        allowNull: false
      })
    )
  }
})
