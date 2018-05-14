module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'goals',
        'percentage',
        {
          type: Sequelize.INTEGER,
          defaultValue: 50
        }
      )
  }
})
