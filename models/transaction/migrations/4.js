module.exports = Sequelize => ({
  up (queryInterface) {
    return (
      queryInterface.changeColumn('transactions', 'quovo_transaction_id', {
        type: Sequelize.BIGINT,
        allowNull: false
      }),
      queryInterface.changeColumn('transactions', 'quovo_account_id', {
        type: Sequelize.BIGINT,
        allowNull: false
      }),
      queryInterface.changeColumn('transactions', 'quovo_connection_id', {
        type: Sequelize.BIGINT,
        allowNull: false
      }),
      queryInterface.changeColumn('transactions', 'quovo_user_id', {
        type: Sequelize.BIGINT,
        allowNull: false
      })
    )
  }
})
