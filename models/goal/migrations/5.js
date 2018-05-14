module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'goals',
        'amount',
        {
          type: Sequelize.INTEGER,
          defaultValue: 500000
        }
      )
  }
})
