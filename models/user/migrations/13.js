module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.addColumn('users', 'expo_push_token', {
      type: Sequelize.STRING
    })
  }
})
