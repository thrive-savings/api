module.exports = (Sequelize) => ({
  attributes: {
    description: {
      type: Sequelize.STRING
    },
    image: {
      type: Sequelize.TEXT
    }
  },
  associations: {
    belongsTo: 'User'
  },
  indexes: [
    { fields: ['user_id'] }
  ]
})
