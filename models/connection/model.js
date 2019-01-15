module.exports = (Sequelize, Account) => ({
  attributes: {
    // General
    value: {
      type: Sequelize.INTEGER,
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

    // Sync info
    lastGoodSync: {
      type: Sequelize.DATE,
      field: 'last_good_sync'
    },
    lastSync: {
      type: Sequelize.DATE,
      field: 'last_sync'
    },
    status: {
      type: Sequelize.STRING
    },
    statusDetails: {
      type: Sequelize.JSON,
      field: 'status_details'
    },

    // Quovo IDs
    quovoConnectionID: {
      allowNull: false,
      type: Sequelize.BIGINT,
      field: 'quovo_connection_id'
    },
    quovoUserID: {
      allowNull: false,
      type: Sequelize.BIGINT,
      field: 'quovo_user_id'
    },
    quovoInstitutionID: {
      allowNull: false,
      type: Sequelize.BIGINT,
      field: 'quovo_institution_id'
    },

    // DB references
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
    institutionID: {
      type: Sequelize.INTEGER,
      defaultValue: 1,
      references: {
        model: 'institutions',
        key: 'id'
      },
      field: 'institution_id'
    },

    // Dates
    createdAt: {
      type: Sequelize.DATE,
      field: 'created_at'
    },
    updatedAt: {
      type: Sequelize.DATE,
      field: 'updated_at'
    }
  },
  instanceMethods: {
    getData () {
      let institution
      if (this.institution) {
        institution = this.institution.getData()
      }

      let accounts
      if (this.accounts) {
        accounts = this.accounts
        accounts = accounts.map(account => account.getData())
      }

      return {
        id: this.id,
        quovoConnectionID: this.quovoConnectionID,
        quovoInstitutionID: this.quovoInstitutionID,
        institutionName: this.institutionName,
        isDefault: this.isDefault,
        sync: {
          status: 'good', // TODO: this.status,
          details: this.statusDetails,
          lastGoodSync: this.lastGoodSync,
          lastSync: this.lastSync
        },
        accounts,
        institution
      }
    }
  },
  associations: {
    belongsTo: ['User', 'Institution'],
    hasMany: 'Account'
  },
  indexes: [{ fields: ['user_id', 'institution_id'] }],
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
})
