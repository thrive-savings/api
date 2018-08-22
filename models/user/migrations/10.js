module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.addColumn('users', 'forced_fetch_frequency', {
      type: Sequelize.STRING
    })
  }
})
