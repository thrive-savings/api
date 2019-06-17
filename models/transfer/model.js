module.exports = (Sequelize, uuid, config, moment) => {
  const {
    TRANSFER: {
      STATES,
      TYPES,
      SUBTYPES,
      APPROVAL_STATES,
      REQUEST_METHODS
    }
  } = config.constants

  return {
    attributes: {
      // General Info
      amount: {
        type: Sequelize.INTEGER,
        field: 'amount',
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM,
        values: Object.values(TYPES),
        field: 'type',
        allowNull: false
      },
      subtype: {
        type: Sequelize.ENUM,
        values: Object.values(SUBTYPES),
        field: 'subtype',
        allowNull: false
      },

      // Processing Data
      state: {
        type: Sequelize.ENUM,
        values: Object.values(STATES),
        defaultValue: STATES.QUEUED,
        field: 'state'
      },
      stateRaw: {
        type: Sequelize.STRING,
        field: 'state_raw'
      },
      timeline: {
        type: Sequelize.ARRAY(Sequelize.JSON),
        field: 'timeline',
        defaultValue: [
          {
            note: 'Created @thrive',
            date: moment(),
            state: STATES.QUEUED
          }
        ]
      },

      // Extra Info
      requestMethod: {
        type: Sequelize.ENUM,
        values: Object.values(REQUEST_METHODS),
        defaultValue: REQUEST_METHODS.AUTOMATED,
        field: 'request_method'
      },
      approvalState: {
        type: Sequelize.ENUM,
        values: Object.values(APPROVAL_STATES),
        defaultValue: APPROVAL_STATES.NOT_NEEDED
      },
      extra: {
        type: Sequelize.JSON,
        field: 'extra'
      },

      // Reference Values
      uuid: {
        type: Sequelize.STRING,
        unique: true
      },
      platformID: {
        type: Sequelize.STRING,
        unique: true,
        field: 'platform_id'
      },

      // Reference IDs
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
    classMethods: {},
    instanceMethods: {
      getData () {
        return {
          id: this.id,
          amount: this.amount,
          type: this.type,
          subtype: this.subtype,
          state: this.state,
          requestMethod: this.requestMethod,
          approvalState: this.approvalState,
          extra: this.extra
        }
      },

      getCanadianAccountID () {
        const { extra: { accountID } = {} } = this
        return accountID
      },

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
    timestamps: true
  }
}
