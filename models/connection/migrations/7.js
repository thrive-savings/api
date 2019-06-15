module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.addColumn('connections', 'country_code', {
      type: Sequelize.STRING
    })
  }
})
