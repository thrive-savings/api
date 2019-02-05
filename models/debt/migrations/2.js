module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.addColumn('debts', 'accelerate_on', {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    })
  }
})
