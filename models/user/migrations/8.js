module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'users',
        'work_type',
        {
          type: Sequelize.STRING,
          allowNull: true
        }
      )
  }
})
