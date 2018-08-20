module.exports = Sequelize => ({
  up (queryInterface) {
    return (
      queryInterface.addColumn('users', 'user_type', {
        type: Sequelize.ENUM,
        values: ['regular', 'vip', 'tester', 'admin'],
        defaultValue: 'regular'
      }),
      queryInterface.addColumn('users', 'require_approval', {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      })
    )
  }
})
