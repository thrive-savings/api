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
    logo: {
      type: Sequelize.STRING,
      field: 'logo'
    },
    details: {
      type: Sequelize.JSON,
      field: 'details'
    },
    accessInfo: {
      type: Sequelize.JSON,
      field: 'access_info'
    },
    connectedCount: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      field: 'connected_count'
    },
    displayOnTop: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      field: 'display_on_top'
    },
    isTest: {
      type: Sequelize.BOOLEAN,
      field: 'is_test'
    },
    isAvailable: {
      type: Sequelize.BOOLEAN,
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
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
})
