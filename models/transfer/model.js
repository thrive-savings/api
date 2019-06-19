module.exports = (Sequelize, uuid, config, moment) => {
  const {
    TRANSFER: { STATES, TYPES, SUBTYPES, APPROVAL_STATES, REQUEST_METHODS }
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
    classMethods: {
      formWhere (userID, filter = {}) {
        const where = { userID }
        if (filter.state) {
          if (Array.isArray(filter.state)) {
            where.state = { [Sequelize.Op.in]: filter.state }
          } else {
            where.state = filter.state
          }
        }
        if (filter.type) {
          where.type = filter.type
        }
        if (filter.subtype) {
          where.subtype = filter.subtype
        }
        if (filter.fromDate) {
          where.createdAt = {
            [Sequelize.Op.gt]: filter.fromDate
          }
        }

        return where
      },

      async fetchHistory (userID, filter = {}) {
        const where = this.formWhere(userID, filter)

        const transfers = await this.findAll({ where, order: [['id', 'DESC']] })
        return transfers
      },

      async countCustom (userID, filter = {}) {
        const where = this.formWhere(userID, filter)

        const count = await this.count({ where })
        return count
      },

      async sumCustom (userID, filter = {}) {
        const transfers = await this.fetchHistory(userID, filter)

        let sum = 0
        for (const { type, amount } of transfers) {
          sum += type === TYPES.DEBIT ? amount : -1 * amount
        }
        return sum
      },

      async lastTransfer (userID, filter = {}) {
        const where = this.formWhere(userID, filter)

        const lastTransfer = await this.findOne({
          where
        })
        return lastTransfer
      }
    },
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
