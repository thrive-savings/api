module.exports = Sequelize => ({
  up (queryInterface) {
    return (
      queryInterface.changeColumn('accounts', 'value', {
        type: Sequelize.INTEGER,
        defaultValue: 0
      }),
      queryInterface.changeColumn('accounts', 'available_balance', {
        type: Sequelize.INTEGER,
        defaultValue: 0
      }),
      queryInterface.changeColumn('accounts', 'present_balance', {
        type: Sequelize.INTEGER,
        defaultValue: 0
      }),
      queryInterface.addColumn('accounts', 'quovo_connection_id', {
        type: Sequelize.INTEGER,
        allowNull: false
      }),
      queryInterface.addColumn('accounts', 'quovo_user_id', {
        type: Sequelize.INTEGER,
        allowNull: false
      })
    )
  }
})
