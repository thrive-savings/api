module.exports = Sequelize => ({
  up (queryInterface) {
    return (
      queryInterface.removeColumn('accounts', 'first_name'),
      queryInterface.removeColumn('accounts', 'last_name'),
      queryInterface
        .changeColumn('accounts', 'user_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
          field: 'user_id'
        })
        .then(() => queryInterface.removeIndex('accounts', ['user_id'])),
      queryInterface.addColumn('accounts', 'value', {
        type: Sequelize.FLOAT,
        defaultValue: 0
      }),
      queryInterface.addColumn('accounts', 'category', {
        type: Sequelize.STRING
      }),
      queryInterface.addColumn('accounts', 'owner_type', {
        type: Sequelize.STRING
      }),
      queryInterface.addColumn('accounts', 'name', {
        type: Sequelize.STRING
      }),
      queryInterface.addColumn('accounts', 'nickname', {
        type: Sequelize.STRING
      }),
      queryInterface.addColumn('accounts', 'quovo_account_id', {
        type: Sequelize.INTEGER
      }),
      queryInterface
        .addColumn('accounts', 'connection_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'connections',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        })
        .then(() => queryInterface.addIndex('accounts', ['connection_id']))
    )
  },
  down (queryInterface) {
    return queryInterface.removeIndex('accounts', ['connection_id'])
  }
})
