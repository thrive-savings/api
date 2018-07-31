module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.addColumn(
      'companies',
      'brand_logo_url',
      {
        type: Sequelize.STRING
      }
    )
  }
})
