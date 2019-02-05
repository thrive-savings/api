module.exports = Sequelize => ({
  up (queryInterface) {
    return (
      queryInterface.removeColumn('accounts', 'title'),
      queryInterface.removeColumn('accounts', 'token'),
      queryInterface.removeColumn('accounts', 'bank'),
      queryInterface.removeColumn('accounts', 'full_name'),
      queryInterface.addColumn('accounts', 'full_number', {
        type: Sequelize.STRING
      }),
      queryInterface.addColumn('accounts', 'iban', {
        type: Sequelize.STRING
      }),
      queryInterface.addColumn('accounts', 'owner_details', {
        type: Sequelize.JSON
      }),
      queryInterface.addColumn('accounts', 'extras', {
        type: Sequelize.JSON
      })
    )
  }
})
