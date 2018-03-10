module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .changeColumn(
        'goals',
        'image',
        {
          type: Sequelize.TEXT
        }
      )
  }
})
