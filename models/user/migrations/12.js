module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.addColumn('users', 'algo_boost', {
      type: Sequelize.INTEGER,
      defaultValue: 100
    })
  }
})
