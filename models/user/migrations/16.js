module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .changeColumn(
        'users',
        'saving_type',
        {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'Thrive Flex'
        }
      )
  }
})
