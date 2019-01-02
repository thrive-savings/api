module.exports = Sequelize => ({
  up (queryInterface) {
    return (
      queryInterface.changeColumn('connections', 'quovo_connection_id', {
        type: Sequelize.BIGINT,
        allowNull: false
      }),
      queryInterface.changeColumn('connections', 'quovo_user_id', {
        type: Sequelize.BIGINT,
        allowNull: false
      })
    )
  }
})
