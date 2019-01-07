module.exports = Sequelize => ({
  attributes: {
    quovoInstitutionID: {
      allowNull: false,
      type: Sequelize.INTEGER,
      field: 'quovo_institution_id'
    },
    name: {
      type: Sequelize.STRING,
      field: 'name'
    },
    website: {
      type: Sequelize.STRING,
      field: 'website'
    },
    logoFolder: {
      type: Sequelize.STRING,
      defaultValue: 'ThriveBank',
      field: 'logo_folder'
    },
    brandColor: {
      type: Sequelize.STRING,
      defaultValue: '#0089CB',
      field: 'brand_color'
    },
    details: {
      type: Sequelize.JSON,
      field: 'details'
    },
    accessInfo: {
      type: Sequelize.JSON,
      field: 'access_info'
    },
    isTest: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      field: 'is_test'
    },
    isAvailable: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      field: 'is_available'
    },
    countryCode: {
      type: Sequelize.STRING,
      defaultValue: 'CAN',
      field: 'country_code'
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
  instanceMethods: {
    getData () {
      return {
        id: this.id,
        quovoInstitutionID: this.quovoInstitutionID,
        name: this.name,
        logoFolder: this.logoFolder,
        brandColor: this.brandColor
      }
    }
  },
  associations: {
    hasMany: 'Connection'
  },
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
})
