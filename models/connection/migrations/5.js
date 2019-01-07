module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn('connections', 'institution_id', {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        references: {
          model: 'institutions',
          key: 'id'
        }
      })
      .then(() => queryInterface.addIndex('connections', ['institution_id']))
  },
  down (queryInterface) {
    return queryInterface.removeIndex('connections', ['institution_id'])
  }
})
