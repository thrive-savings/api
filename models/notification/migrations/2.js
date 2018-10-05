module.exports = Sequelize => ({
  up (queryInterface) {
    return (
      queryInterface.removeColumn('notifications', 'root_notification_id'),
      queryInterface.addColumn('notifications', 'event', {
        type: Sequelize.STRING
      }),
      queryInterface.addColumn('notifications', 'condition_model', {
        type: Sequelize.STRING,
        defaultValue: 'users'
      })
    )
  }
})
