module.exports = Sequelize => ({
  up (queryInterface) {
    return (
      queryInterface.addColumn('users', 'relink_required', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }),
      queryInterface.addColumn('users', 'onboarding_step', {
        type: Sequelize.STRING
      })
    )
  }
})
