module.exports = (Sequelize) => ({
  attributes: {
    code: {
      type: Sequelize.INTEGER
    },
    name: {
      type: Sequelize.STRING
    }
  },
  associations: {
    hasMany: 'User'
  }
})
