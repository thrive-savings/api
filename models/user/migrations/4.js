module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .changeColumn(
        'users',
        'avatar',
        {
          type: Sequelize.TEXT
        }
      )
  }
})
