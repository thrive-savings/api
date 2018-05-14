module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'goals',
        'category',
        {
          type: Sequelize.STRING
        }
      )
  }
})
