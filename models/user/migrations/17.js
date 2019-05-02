module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface.addColumn('users', 'referral_code', {
      type: Sequelize.STRING,
      unique: true
    })
  }
})
