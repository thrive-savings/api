module.exports = Sequelize => ({
  up (queryInterface) {
    return (
      queryInterface.changeColumn('connections', 'value', {
        type: Sequelize.INTEGER,
        defaultValue: 0
      }),
      queryInterface.addColumn('connections', 'quovo_user_id', {
        type: Sequelize.INTEGER,
        allowNull: false
      })
    )
  }
})
