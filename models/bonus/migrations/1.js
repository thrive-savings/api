module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .createTable('bonuses', {
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
        companyID: {
          type: Sequelize.INTEGER,
          allowNull: false,
          field: 'company_id',
          references: {
            model: 'companies',
            key: 'id'
          }
        },
        userID: {
          type: Sequelize.INTEGER,
          allowNull: false,
          field: 'user_id',
          references: {
            model: 'users',
            key: 'id'
          }
        },
        createdAt: {
          type: Sequelize.DATE,
          field: 'created_at'
        },
        notificationSeenDate: {
          type: Sequelize.DATE,
          field: 'notification_seen_date'
        }
      })
      .then(() => queryInterface.addIndex('bonuses', ['user_id', 'company_id']))
  },
  down (queryInterface) {
    return queryInterface
      .dropTable('bonuses')
      .then(() => queryInterface.removeIndex('bonuses', ['user_id', 'company_id']))
  }
})
