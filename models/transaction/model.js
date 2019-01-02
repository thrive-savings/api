module.exports = Sequelize => ({
  attributes: {
    // General
    value: {
      type: Sequelize.INTEGER
    },
    fees: {
      type: Sequelize.INTEGER,
      defaultValue: 0
    },
    date: {
      type: Sequelize.DATE
    },
    isCancel: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      field: 'is_cancel'
    },
    isPending: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      field: 'is_pending'
    },

    // Categorization
    description: {
      type: Sequelize.STRING
    },
    category: {
      type: Sequelize.STRING
    },
    subcategory: {
      type: Sequelize.STRING
    },
    type: {
      type: Sequelize.STRING
    },
    subtype: {
      type: Sequelize.STRING
    },
    transactionType: {
      type: Sequelize.ENUM,
      values: ['debit', 'credit'],
      allowNull: false,
      field: 'transaction_type'
    },

    // Quovo IDs
    quovoTransactionID: {
      type: Sequelize.BIGINT,
      field: 'quovo_transaction_id',
      allowNull: false
    },
    quovoAccountID: {
      type: Sequelize.BIGINT,
      field: 'quovo_account_id',
      allowNull: false
    },
    quovoConnectionID: {
      type: Sequelize.BIGINT,
      field: 'quovo_connection_id',
      allowNull: false
    },
    quovoUserID: {
      type: Sequelize.BIGINT,
      field: 'quovo_user_id',
      allowNull: false
    },

    // References
    accountID: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'account_id',
      references: {
        model: 'accounts',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    }
  },
  associations: {
    belongsTo: 'Account'
  },
  indexes: [{ fields: ['account_id'] }]
})
