module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'users',
        'restore_password_code_expires_at',
        {
          type: Sequelize.DATE
        }
      )
  }
})
