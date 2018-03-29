module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .createTable('companies', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          field: 'id'
        },
        code: {
          type: Sequelize.STRING,
          field: 'code'
        },
        name: {
          type: Sequelize.STRING,
          field: 'name'
        }
      })
      .then(() => {
        queryInterface.bulkInsert('companies', [{code: 'PERSONAL', name: 'PERSONAL'}])
      })
  },
  down (queryInterface) {
    return queryInterface
      .dropTable('companies')
  }
})
