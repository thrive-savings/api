module.exports = Sequelize => ({
  attributes: {
    channel: {
      type: Sequelize.ENUM,
      values: ['sms', 'push', 'email'],
      defaultValue: 'sms'
    },
    message: {
      type: Sequelize.JSON
    },
    smsFallbackMessage: {
      type: Sequelize.STRING,
      field: 'sms_fallback_message'
    },
    condition: {
      type: Sequelize.JSON
    },
    conditionModel: {
      type: Sequelize.STRING,
      defaultValue: 'users',
      field: 'condition_model'
    },
    fireDate: {
      type: Sequelize.DATE,
      field: 'fire_date'
    },
    recurAfter: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      field: 'recur_after'
    },
    recurAfterWord: {
      type: Sequelize.ENUM,
      values: [
        'milliseconds',
        'seconds',
        'minutes',
        'hours',
        'days',
        'weeks',
        'months',
        'quarters',
        'years'
      ],
      defaultValue: 'days',
      field: 'recur_after_word'
    },
    recurCount: {
      type: Sequelize.INTEGER,
      defaultValue: 1,
      field: 'recur_count'
    },
    description: {
      type: Sequelize.STRING
    },
    event: {
      type: Sequelize.STRING
    },
    userID: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    createdAt: {
      type: Sequelize.DATE,
      field: 'created_at'
    }
  },
  associations: {
    belongsTo: 'User'
  },
  indexes: [{ fields: ['user_id'] }],
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false,
  fireDate: false
})
