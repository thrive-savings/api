module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.changeColumn('users', 'quovo_user_id', {
      type: Sequelize.BIGINT
    })
  }
})
