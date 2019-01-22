module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.changeColumn('queues', 'account_id', {
      type: Sequelize.INTEGER,
      allowNull: true
    })
  }
})
