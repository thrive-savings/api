module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.addColumn('transactions', 'transaction_type', {
      type: Sequelize.ENUM,
      values: ['debit', 'credit'],
      allowNull: false
    })
  }
})
