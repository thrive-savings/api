module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.addColumn(
      'users',
      'work_type',
      {
        type: Sequelize.STRING,
        allowNull: true
      }
    ),
    queryInterface.addColumn(
      'users',
      'saving_type',
      {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Thrive Flex'
      }
    ),
    queryInterface.addColumn(
      'users',
      'fixed_contribution',
      {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 2000
      }
    ),
    queryInterface.addColumn(
      'users',
      'restore_password_code',
      {
        type: Sequelize.STRING
      }
    ),
    queryInterface.addColumn(
      'users',
      'restore_password_code_expires_at',
      {
        type: Sequelize.DATE
      }
    ),
    queryInterface.addColumn(
      'users',
      'gender',
      {
        type: Sequelize.STRING
      }
    ),
    queryInterface.addColumn(
      'users',
      'saving_preferences_set',
      {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }
    ),
    queryInterface.addColumn(
      'users',
      'bank_linked',
      {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      }
    )
  }
})
