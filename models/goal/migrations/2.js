module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.addColumn(
      'goals',
      'category',
      {
        type: Sequelize.STRING
      }
    ),
    queryInterface.addColumn(
      'goals',
      'name',
      {
        type: Sequelize.STRING
      }
    ),
    queryInterface.addColumn(
      'goals',
      'amount',
      {
        type: Sequelize.INTEGER,
        defaultValue: 500000
      }
    ),
    queryInterface.addColumn(
      'goals',
      'percentage',
      {
        type: Sequelize.INTEGER,
        defaultValue: 50
      }
    ),
    queryInterface.addColumn(
      'goals',
      'desired_date',
      {
        type: Sequelize.DATE,
        allowNull: true
      }
    ),
    queryInterface.addColumn(
      'goals',
      'created_at',
      {
        type: Sequelize.DATE
      }
    )
  }
})
