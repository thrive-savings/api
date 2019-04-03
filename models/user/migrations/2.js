module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.addColumn('users', 'is_active', {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    })
  }
})
