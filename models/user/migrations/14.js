module.exports = Sequelize => ({
  up (queryInterface) {
    return (
      queryInterface.addColumn('users', 'quovo_user_id', {
        type: Sequelize.INTEGER
      }),
      queryInterface.addColumn('users', 'quovo_user_name', {
        type: Sequelize.STRING
      })
    )
  }
})
