module.exports = Sequelize => ({
  up (queryInterface) {
    return (
      queryInterface.removeColumn('accounts', 'full_number'),
      queryInterface.addColumn('accounts', 'details_set_by_user', {
        type: Sequelize.JSON
      })
    )
  }
})
