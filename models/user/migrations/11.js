module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'users',
        'restore_password_code',
        {
          type: Sequelize.DATE
        }
      )
  }
})
