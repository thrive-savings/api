module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .createTable('accounts', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          field: 'id'
        },
        bank: {
          type: Sequelize.STRING,
          field: 'bank'
        },
        fullName: {
          type: Sequelize.STRING,
          field: 'full_name'
        },
        firstName: {
          type: Sequelize.STRING,
          field: 'first_name'
        },
        institution: {
          type: Sequelize.STRING,
          field: 'institution'
        },
        isDefault: {
          type: Sequelize.BOOLEAN,
          field: 'is_default'
        },
        lastName: {
          type: Sequelize.STRING,
          field: 'last_name'
        },
        number: {
          type: Sequelize.STRING,
          field: 'number'
        },
        title: {
          type: Sequelize.STRING,
          field: 'title'
        },
        token: {
          type: Sequelize.STRING,
          field: 'token'
        },
        transit: {
          type: Sequelize.STRING,
          field: 'transit'
        },
        type: {
          type: Sequelize.STRING,
          field: 'type'
        },
        versapay_token: {
          type: Sequelize.STRING
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
        }
      })
      .then(() => queryInterface.addIndex('accounts', ['user_id']))
  },
  down (queryInterface) {
    return queryInterface
      .dropTable('accounts')
      .then(() => queryInterface.removeIndex('accounts', ['user_id']))
  }
})
