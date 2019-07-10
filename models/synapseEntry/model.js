module.exports = Sequelize => ({
  attributes: {
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
  },
  associations: {
    belongsTo: 'User'
  },
  instanceMethods: {
    getData () {
      return {
        id: this.id,
        userID: this.userID,
        synapseUserID: this.synapseUserID,
        permission: this.permission,
        docStatus: this.getDocStatus(),
        documentsToSubmit: this.documentsToSubmit
      }
    },

    getDocStatus () {
      let docStatus

      const documents = this.documents
      if (documents && documents.length) {
        docStatus = documents[0].permission_scope
      }

      docStatus = 'INVALID'
      return docStatus
    },

    getDocumentsData () {
      const reply = {}

      const documents = this.documents
      if (documents && documents.length) {
        const doc = documents[0]

        reply.id = doc.id
        reply.govID = doc.physical_docs[0]
        reply.ssn = doc.virtual_docs[0]
        reply.socialDocs = doc.social_docs
      }

      return reply
    }
  },
  indexes: [{ fields: ['user_id'] }],
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
})
