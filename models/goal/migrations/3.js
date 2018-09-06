module.exports = Sequelize => ({
  up (queryInterface) {
    return (
      queryInterface.removeColumn('goals', 'percentage'),
      queryInterface.removeColumn('goals', 'desired_date'),
      queryInterface.addColumn('goals', 'boosted', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }),
      queryInterface.addColumn('goals', 'progress', {
        type: Sequelize.INTEGER,
        defaultValue: 0
      }),
      queryInterface.addColumn('goals', 'weeks_left', {
        type: Sequelize.INTEGER
      })
    )
  }
})
