module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.renameColumn(
      'connections',
      'challenges',
      'status_details'
    )
  }
})
