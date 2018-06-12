module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .createTable('users', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        acceptedAt: {
          type: Sequelize.DATE,
          field: 'accepted_at'
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        phone: {
          type: Sequelize.STRING,
          allowNull: true,
          unique: true
        },
        password: {
          type: Sequelize.STRING
        },
        code: {
          type: Sequelize.STRING
        },
        isVerified: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          field: 'is_verified'
        },
        restorePasswordToken: {
          type: Sequelize.STRING,
          field: 'restore_password_token'
        },
        restorePasswordTokenExpiresAt: {
          type: Sequelize.DATE,
          field: 'restore_password_token_expires_at'
        },
        firstName: {
          type: Sequelize.STRING,
          field: 'first_name'
        },
        middleName: {
          type: Sequelize.STRING,
          field: 'middle_name'
        },
        lastName: {
          type: Sequelize.STRING,
          field: 'last_name'
        },
        dob: {
          type: Sequelize.STRING,
          field: 'dob'
        },
        occupation: {
          type: Sequelize.STRING,
          field: 'occupation'
        },
        unit: {
          type: Sequelize.STRING,
          field: 'unit'
        },
        address: {
          type: Sequelize.STRING,
          field: 'address'
        },
        city: {
          type: Sequelize.STRING,
          field: 'city'
        },
        province: {
          type: Sequelize.STRING,
          field: 'province'
        },
        country: {
          type: Sequelize.STRING,
          field: 'country'
        },
        postalCode: {
          type: Sequelize.STRING,
          field: 'postal_code'
        },
        isCanadianResident: {
          type: Sequelize.BOOLEAN,
          field: 'is_canadian_resident'
        },
        isUSResident: {
          type: Sequelize.BOOLEAN,
          field: 'is_us_resident'
        },
        isPoliticallyExposed: {
          type: Sequelize.BOOLEAN,
          field: 'is_politically_exposed'
        },
        isOpeningForThirdParty: {
          type: Sequelize.BOOLEAN,
          field: 'is_opening_for_third_party'
        },
        isTOSAccepted: {
          type: Sequelize.BOOLEAN,
          field: 'is_tos_accepted'
        },
        isPPAccepted: {
          type: Sequelize.BOOLEAN,
          field: 'is_privacy_policy_accepted'
        },
        signature: {
          type: Sequelize.TEXT,
          field: 'signature'
        },
        balance: {
          type: Sequelize.FLOAT,
          defaultValue: 0,
          field: 'balance'
        },
        avatar: {
          type: Sequelize.STRING,
          field: 'avatar'
        },
        createdAt: {
          type: Sequelize.DATE,
          field: 'created_at'
        },
        isWelcomed: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          field: 'is_welcomed'
        }
      })
      .then(() => queryInterface.addIndex('users', ['code']))
  },
  down (queryInterface) {
    return queryInterface
      .dropTable('users')
      .then(() => queryInterface.removeIndex('users', ['code']))
  }
})
