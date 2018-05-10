module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .changeColumn(
        'users',
        'phone',
        {
          type: Sequelize.STRING,
          allowNull: true,
          unique: true
        }
      )
  }
})
