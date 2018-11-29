module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .createTable('connections', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          field: 'id'
        },
        value: {
          type: Sequelize.FLOAT,
          defaultValue: 0
        },
        isDefault: {
          type: Sequelize.BOOLEAN,
          field: 'is_default'
        },
        institutionName: {
          type: Sequelize.STRING,
          field: 'institution_name'
        },
        lastGoodSync: {
          type: Sequelize.DATE,
          field: 'last_good_sync'
        },
        lastSync: {
          type: Sequelize.DATE,
          field: 'last_sync'
        },
        status: {
          type: Sequelize.STRING,
          field: 'status'
        },
        challenges: {
          type: Sequelize.JSON,
          field: 'challenges'
        },
        quovoConnectionID: {
          allowNull: false,
          type: Sequelize.INTEGER,
          field: 'quovo_connection_id'
        },
        quovoInstitutionID: {
          allowNull: false,
          type: Sequelize.INTEGER,
          field: 'quovo_institution_id'
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
        },
        createdAt: {
          type: Sequelize.DATE,
          field: 'created_at'
        },
        updatedAt: {
          type: Sequelize.DATE,
          field: 'updated_at'
        }
      })
      .then(() => queryInterface.addIndex('connections', ['user_id']))
  },
  down (queryInterface) {
    return queryInterface
      .dropTable('connections')
      .then(() => queryInterface.removeIndex('connections', ['user_id']))
  }
})
