module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'users',
        'fetch_frequency',
        {
          type: Sequelize.STRING,
          defaultValue: 'ONCEWEEKLY'
        }
      )
  }
})
