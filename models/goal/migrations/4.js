module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'goals',
        'name',
        {
          type: Sequelize.STRING
        }
      )
  }
})
