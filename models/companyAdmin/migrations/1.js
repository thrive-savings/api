module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .createTable('company_admins', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          field: 'id'
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        phone: {
          type: Sequelize.STRING,
          unique: true
        },
        firstName: {
          type: Sequelize.STRING,
          field: 'first_name'
        },
        lastName: {
          type: Sequelize.STRING,
          field: 'last_name'
        },
        password: {
          type: Sequelize.STRING
        },
        companyID: {
          type: Sequelize.INTEGER,
          allowNull: false,
          field: 'company_id',
          references: {
            model: 'companies',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        createdAt: {
          type: Sequelize.DATE,
          field: 'created_at'
        }
      })
      .then(() => queryInterface.addIndex('company_admins', ['company_id']))
  },
  down (queryInterface) {
    return queryInterface
      .dropTable('company_admins')
      .then(() => queryInterface.removeIndex('company_admins', ['company_id']))
  }
})
