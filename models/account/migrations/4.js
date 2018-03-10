module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .removeColumn(
        'accounts',
        'login_id'
      )
  }
})
