module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.addColumn(
      'queues',
      'state',
      {
        type: Sequelize.STRING
      }
    ),
    queryInterface.addColumn(
      'queues',
      'state_updated_date',
      {
        type: Sequelize.DATE
      }
    ),
    queryInterface.addColumn(
      'queues',
      'transaction_reference',
      {
        type: Sequelize.STRING
      }
    ),
    queryInterface.addColumn(
      'queues',
      'versapay_token',
      {
        type: Sequelize.STRING
      }
    ),
    queryInterface.addColumn(
      'queues',
      'account_id',
      {
        type: Sequelize.INTEGER
      }
    )
  }
})
