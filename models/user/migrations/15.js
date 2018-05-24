module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'users',
        'employer_bonus',
        {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }
      )
  }
})
