module.exports = (Sequelize, Account) => ({
  attributes: {
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
      type: Sequelize.STRING
    },
    statusDetails: {
      type: Sequelize.JSON,
      field: 'status_details'
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
  },
  associations: {
    belongsTo: 'User',
    hasMany: 'Account'
  },
  instanceMethods: {
    getData () {
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
          status: this.status,
          details: this.statusDetails,
          lastGoodSync: this.lastGoodSync,
          lastSync: this.lastSync
        },
        accounts
      }
    }
  },
  indexes: [{ fields: ['user_id'] }],
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
})
