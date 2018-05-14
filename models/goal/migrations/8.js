module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'goals',
        'created_at',
        {
          type: Sequelize.DATE
        }
      )
  }
})
