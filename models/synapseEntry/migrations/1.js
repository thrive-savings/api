module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .createTable('synapse_entries', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          field: 'id'
        },

        // Important KYC Info
        permission: {
          type: Sequelize.STRING,
          field: 'permission'
        },
        docStatus: {
          type: Sequelize.JSON,
          field: 'doc_status'
        },
        documents: {
          type: Sequelize.ARRAY(Sequelize.JSON),
          field: 'documents'
        },
        documentsToSubmit: {
          type: Sequelize.JSON,
          field: 'documents_to_submit'
        },
        extra: {
          type: Sequelize.JSON,
          field: 'extra'
        },

        // General Info
        logins: {
          type: Sequelize.ARRAY(Sequelize.JSON),
          field: 'logins'
        },
        emails: {
          type: Sequelize.ARRAY(Sequelize.STRING),
          field: 'emails'
        },
        legalNames: {
          type: Sequelize.ARRAY(Sequelize.STRING),
          field: 'legal_names'
        },
        phoneNumbers: {
          type: Sequelize.ARRAY(Sequelize.STRING),
          field: 'phone_numbers'
        },
        photos: {
          type: Sequelize.ARRAY(Sequelize.STRING),
          field: 'photos'
        },

        // Reference IDs
        synapseUserID: {
          type: Sequelize.STRING,
          allowNull: false,
          field: 'synapse_user_id'
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

        // Automated Dates
        createdAt: {
          type: Sequelize.DATE,
          field: 'created_at'
        },
        updatedAt: {
          type: Sequelize.DATE,
          field: 'updated_at'
        }
      })
      .then(() => queryInterface.addIndex('synapse_entries', ['user_id']))
  },
  down (queryInterface) {
    return queryInterface
      .dropTable('synapse_entries')
      .then(() => queryInterface.removeIndex('synapse_entries', ['user_id']))
  }
})
