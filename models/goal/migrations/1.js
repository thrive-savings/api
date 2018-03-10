module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .createTable('goals', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          field: 'id'
        },
        description: {
          type: Sequelize.STRING,
          field: 'description'
        },
        image: {
          type: Sequelize.STRING,
          field: 'image'
        },
        userID: {
          type: Sequelize.INTEGER,
          allowNull: false,
          field: 'user_id',
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        }
      })
      .then(() => queryInterface.addIndex('goals', ['user_id']))
  },
  down (queryInterface) {
    return queryInterface
      .dropTable('goals')
      .then(() => queryInterface.removeIndex('goals', ['user_id']))
  }
})
