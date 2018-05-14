module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'goals',
        'desired_date',
        {
          type: Sequelize.DATE,
          allowNull: true
        }
      )
  }
})
