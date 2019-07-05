module.exports = Sequelize => ({
  attributes: {
    // Important KYC Info
    type: {
      type: Sequelize.STRING,
      field: 'type'
    },
    allowed: {
      type: Sequelize.STRING,
      field: 'allowed'
    },
    info: {
      type: Sequelize.JSON,
      field: 'info'
    },
    extra: {
      type: Sequelize.JSON,
      field: 'extra'
    },

    // General Info
    isActive: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    timeline: {
      type: Sequelize.ARRAY(Sequelize.JSON),
      field: 'timeline'
    },

    // Reference IDs

    synapseNodeID: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'synapse_node_id'
    },
    synapseUserID: {
      type: Sequelize.STRING,
      allowNull: false,
      field: 'synapse_user_id'
    },
    accountID: {
      type: Sequelize.INTEGER,
      allowNull: true,
      field: 'account_id'
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

    // Automated Dates
    createdAt: {
      type: Sequelize.DATE,
      field: 'created_at'
    },
    updatedAt: {
      type: Sequelize.DATE,
      field: 'updated_at'
    }
  },
  associations: {
    belongsTo: 'User'
  },
  indexes: [{ fields: ['user_id'] }],
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
})
