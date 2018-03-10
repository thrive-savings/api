module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .createTable('queues', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          field: 'id'
        },
        amount: {
          type: Sequelize.INTEGER,
          field: 'amount'
        },
        createdAt: {
          type: Sequelize.DATE,
          field: 'created_at'
        },
        type: {
          type: Sequelize.STRING,
          field: 'type'
        },
        processed: {
          type: Sequelize.BOOLEAN,
          field: 'processed'
        },
        processedDate: {
          type: Sequelize.DATE,
          field: 'processed_date'
        },
        requestMethod: {
          type: Sequelize.STRING,
          field: 'request_method'
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
      .then(() => queryInterface.addIndex('queues', ['user_id']))
  },
  down (queryInterface) {
    return queryInterface
      .dropTable('queues')
      .then(() => queryInterface.removeIndex('queues', ['user_id']))
  }
})
