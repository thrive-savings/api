module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.addColumn('connections', 'last_good_auth', {
      type: Sequelize.DATE
    })
  }
})
