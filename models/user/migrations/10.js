module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'users',
        'fixed_contribution',
        {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 2000
        }
      )
  }
})
