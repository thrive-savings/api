module.exports = (Sequelize) => ({
  attributes: {
    amount: {
      type: Sequelize.INTEGER
    },
    balance: {
      type: Sequelize.INTEGER
    },
    date: {
      type: Sequelize.DATE
    },
    description: {
      type: Sequelize.STRING
    },
    token: {
      type: Sequelize.STRING
    },
    type: {
      type: Sequelize.STRING
    },
    account_id: {
      type: Sequelize.INTEGER
    }
  },
  associations: {
    belongsTo: 'Account'
  },
  indexes: [
    { fields: ['account_id'] }
  ]
})
