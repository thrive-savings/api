module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'users',
        'bank_linked',
        {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }
      )
  }
})
