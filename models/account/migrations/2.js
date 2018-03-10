module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'accounts',
        'full_name',
        {
          type: Sequelize.STRING
        }
      )
  }
})
