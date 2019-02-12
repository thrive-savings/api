module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.changeColumn('goals', 'amount', {
      type: Sequelize.INTEGER,
      defaultValue: 50000
    })
  }
})
