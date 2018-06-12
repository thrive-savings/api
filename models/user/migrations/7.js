module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'users',
        'company_id',
        {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
          references: {
            model: 'companies',
            key: 'id'
          }
        }
      )
      .then(() => queryInterface.addIndex('users', ['company_id']))
  },
  down (queryInterface) {
    return queryInterface.removeIndex('users', ['company_id'])
  }
})
