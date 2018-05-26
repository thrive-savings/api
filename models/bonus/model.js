module.exports = (Sequelize) => ({
  attributes: {
    amount: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    companyID: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'company_id'
    },
    userID: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'user_id'
    },
    createdAt: {
      type: Sequelize.DATE,
      field: 'created_at'
    },
    notificationSeenDate: {
      type: Sequelize.DATE,
      field: 'notification_seen_date'
    }
  },
  associations: {
    belongsTo: ['User', 'Company']
  },
  indexes: [
    { fields: ['user_id', 'company_id'] }
  ],
  timestamps: true,
  notificationSeenDate: false,
  updatedAt: false
})
