module.exports = (Sequelize, moment) => ({
  attributes: {
    // General
    isDefault: {
      type: Sequelize.BOOLEAN,
      field: 'is_default'
    },
    value: {
      type: Sequelize.INTEGER,
      defaultValue: 0
    },
    availableBalance: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      field: 'available_balance'
    },
    presentBalance: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      field: 'present_balance'
    },
    ownerDetails: {
      type: Sequelize.JSON,
      field: 'owner_details'
    },
    extras: {
      type: Sequelize.JSON
    },

    // Bank numbers
    institution: {
      type: Sequelize.STRING
    },
    transit: {
      type: Sequelize.STRING
    },
    number: {
      type: Sequelize.STRING
    },
    routing: {
      type: Sequelize.STRING
    },
    wireRouting: {
      type: Sequelize.STRING,
      field: 'wire_routing'
    },
    fullNumber: {
      type: Sequelize.STRING,
      field: 'full_number'
    },
    versapay_token: {
      type: Sequelize.STRING
    },

    // Account category and type
    category: {
      type: Sequelize.STRING
    },
    type: {
      type: Sequelize.STRING
    },
    typeConfidence: {
      type: Sequelize.STRING,
      field: 'type_confidence'
    },
    ownerType: {
      type: Sequelize.STRING,
      field: 'owner_type'
    },
    name: {
      type: Sequelize.STRING
    },
    nickname: {
      type: Sequelize.STRING
    },

    // Quovo IDs
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

    // DB refs
    userID: {
      type: Sequelize.INTEGER,
      allowNull: true,
      field: 'user_id'
    },
    connectionID: {
      type: Sequelize.INTEGER,
      field: 'connection_id',
      defaultValue: 1,
      references: {
        model: 'connections',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    }
  },
  associations: {
    belongsTo: 'Connection',
    hasMany: 'Transaction'
  },
  indexes: [{ fields: ['connection_id'] }],
  instanceMethods: {
    getData () {
      const {
        id,
        quovoAccountID,
        name,
        nickname,
        category,
        type,
        availableBalance,
        isDefault
      } = this.dataValues

      return {
        id,
        quovoAccountID,
        name: name.length <= 4 ? name : `xxx${name.slice(-4)}`,
        nickname,
        category,
        type,
        availableBalance,
        isDefault
      }
    },

    getDebtData () {
      const {
        fullNumber,
        name,
        nickname,
        value,
        availableBalance,
        extras
      } = this.dataValues

      const connectionData = {}
      const connection = this.connection
      if (connection) {
        const { lastSync, lastGoodSync } = connection
        connectionData.sync = { lastSync: moment(lastSync).format('MMM D'), lastGoodSync: moment(lastGoodSync).format('MMM D') }

        const institution = connection.institution
        if (institution) {
          connectionData.institution = institution.getData()
        }
      }

      return {
        number: fullNumber || (this.hasFullCCNumber() ? name : undefined),
        name: nickname,
        balance: value !== 0 ? value : availableBalance,
        dueDate: extras && extras.due_date ? extras.due_date : undefined,
        connection: connectionData
      }
    },

    hasFullCCNumber () {
      const trimmedNumber = this.name.replace(/\s/g, '')
      const firstChar = trimmedNumber.charAt(0)
      const numberLength = trimmedNumber.length

      if (!['5', '4', '3'].includes(firstChar)) {
        return false
      } else if (['5', '4'].includes(firstChar) && numberLength !== 16) {
        return false
      } else if (firstChar === '3' && numberLength !== 15) {
        return false
      } else {
        return /^\d+$/.test(trimmedNumber)
      }
    }
  }
})
