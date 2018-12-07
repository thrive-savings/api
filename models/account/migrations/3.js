module.exports = Sequelize => ({
  up (queryInterface) {
    return (
      queryInterface.addColumn('accounts', 'available_balance', {
        type: Sequelize.FLOAT,
        defaultValue: 0
      }),
      queryInterface.addColumn('accounts', 'present_balance', {
        type: Sequelize.FLOAT,
        defaultValue: 0
      }),
      queryInterface.addColumn('accounts', 'routing', {
        type: Sequelize.STRING
      }),
      queryInterface.addColumn('accounts', 'type_confidence', {
        type: Sequelize.STRING
      })
    )
  }
})
