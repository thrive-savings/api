module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.addColumn('accounts', 'wire_routing', {
      type: Sequelize.STRING
    })
  }
})
