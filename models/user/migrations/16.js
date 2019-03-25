module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.addColumn('users', 'next_save_date', {
      type: Sequelize.DATE
    })
  }
})
