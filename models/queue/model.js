module.exports = (Sequelize, uuid) => ({
  attributes: {
    amount: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    createdAt: {
      type: Sequelize.DATE,
      field: 'created_at'
    },
    type: {
      type: Sequelize.STRING,
      allowNull: false
    },
    processed: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    processedDate: {
      type: Sequelize.DATE,
      field: 'processed_date'
    },
    requestMethod: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'request_method'
    },
    state: {
      type: Sequelize.STRING,
      allowNull: true
    },
    stateUpdatedDate: {
      type: Sequelize.DATE,
      field: 'state_updated_date'
    },
    transactionReference: {
      type: Sequelize.STRING,
      allowNull: true, // false
      unique: true,
      field: 'transaction_reference'
    },
    versapay_token: {
      type: Sequelize.STRING,
      allowNull: true
    },
    userID: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'user_id'
    },
    accountID: {
      type: Sequelize.INTEGER,
      allowNull: true,
      field: 'account_id'
    },
    uuid: {
      type: Sequelize.STRING,
      allowNull: true
    }
  },
  classMethods: {
    async sumInProgress (userID, type) {
      const where = {
        userID,
        [Sequelize.Op.or]: [{ processed: false }, { state: 'in_progress' }]
      }
      if (type) {
        where.type =
          type === 'credit' ? 'credit' : { [Sequelize.Op.ne]: 'credit' }
      }

      const queues = await this.findAll({ where })

      let amount = 0
      for (const { type: queueType, amount: queueAmount } of queues) {
        if (type) {
          amount += queueAmount
        } else {
          amount += queueType === 'credit' ? -1 * queueAmount : queueAmount
        }
      }
      return amount
    }
  },
  instanceMethods: {
    setUUID () {
      this.uuid = uuid().replace(/-/g, '')
    }
  },
  hooks: {
    beforeCreate (instance) {
      instance.setUUID()
    }
  },
  associations: {
    belongsTo: 'User'
  },
  indexes: [{ fields: ['user_id'] }],
  timestamps: true,
  processedDate: false,
  updatedAt: false
})
