module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'users',
        'gender',
        {
          type: Sequelize.STRING
        }
      )
  }
})
