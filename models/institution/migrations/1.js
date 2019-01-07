module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .createTable('institutions', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          field: 'id'
        },
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
      })
      .then(() => {
        queryInterface.bulkInsert('institutions', [
          {
            name: 'Thrive Bank',
            website: 'https://thrivesavings.com',
            quovo_institution_id: -1
          }
        ])
      })
  },
  down (queryInterface) {
    return queryInterface.dropTable('institutions')
  }
})
