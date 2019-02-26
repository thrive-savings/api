module.exports = Sequelize => ({
  up (queryInterface) {
    return (
      queryInterface.addColumn('users', 'rating', {
        type: Sequelize.INTEGER,
        defaultValue: 0
      }),
      queryInterface.addColumn('users', 'no_rating_prompt_until', {
        type: Sequelize.DATE
      })
    )
  }
})
