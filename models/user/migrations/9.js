module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .addColumn(
        'users',
        'saving_type',
        {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'flex'
        }
      )
  }
})
