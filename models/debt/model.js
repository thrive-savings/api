module.exports = Sequelize => ({
  attributes: {
    // Amounts
    amountPulled: {
      type: Sequelize.INTEGER,
      field: 'amount_pulled',
      defaultValue: 0
    },
    amountToPay: {
      type: Sequelize.INTEGER,
      field: 'amount_to_pay',
      defaultValue: 10000
    },
    accelerateAmount: {
      type: Sequelize.INTEGER,
      field: 'accelerate_amount',
      defaultValue: 0
    },
    accelerateOn: {
      type: Sequelize.BOOLEAN,
      field: 'accelerate_on',
      defaultValue: false
    },

    // General
    status: {
      type: Sequelize.STRING,
      field: 'status',
      defaultValue: 'off'
    },
    type: {
      type: Sequelize.STRING,
      field: 'type',
      defaultValue: 'Credit Card'
    },

    // Refs
    accountID: {
      type: Sequelize.INTEGER,
      allowNull: true,
      field: 'account_id',
      references: {
        model: 'accounts',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
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

    // Dates
    createdAt: {
      type: Sequelize.DATE,
      field: 'created_at'
    },
    updatedAt: {
      type: Sequelize.DATE,
      field: 'updated_at'
    }
  },
  instanceMethods: {
    getData () {
      const {
        id,
        amountPulled,
        amountToPay,
        accelerateAmount,
        accelerateOn,
        status,
        type,
        accountID
      } = this.dataValues

      return {
        id,
        amountPulled,
        amountToPay,
        accelerateAmount,
        accelerateOn,
        status,
        type,
        accountID
      }
    }
  },
  associations: {
    belongsTo: 'User'
  },
  indexes: [{ fields: ['user_id', 'account_id'] }],
  timestamps: true
})
