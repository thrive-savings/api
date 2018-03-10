module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .changeColumn(
        'users',
        'balance',
        {
          type: Sequelize.INTEGER,
          defaultValue: 0
        }
      )
  }
})
