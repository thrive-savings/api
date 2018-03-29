module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'users',
        'login_id',
        {
          type: Sequelize.STRING
        }
      )
  }
})
