module.exports = Sequelize => ({
  up (queryInterface) {
    return (
      queryInterface.addColumn('debts', 'accelerate_on', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }),
      queryInterface.changeColumn('debts', 'accelerate_amount', {
        type: Sequelize.INTEGER,
        defaultValue: 6000
      })
    )
  }
})
