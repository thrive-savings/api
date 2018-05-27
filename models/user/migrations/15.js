module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'users',
        'saving_preferences_set',
        {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }
      )
  }
})
