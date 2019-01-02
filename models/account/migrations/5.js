module.exports = Sequelize => ({
  up (queryInterface) {
    return (
      queryInterface.changeColumn('accounts', 'quovo_account_id', {
        type: Sequelize.BIGINT,
        allowNull: false
      }),
      queryInterface.changeColumn('accounts', 'quovo_connection_id', {
        type: Sequelize.BIGINT,
        allowNull: false
      }),
      queryInterface.changeColumn('accounts', 'quovo_user_id', {
        type: Sequelize.BIGINT,
        allowNull: false
      })
    )
  }
})
