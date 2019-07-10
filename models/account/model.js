module.exports = Sequelize => ({
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
    detailsSetByUser: {
      type: Sequelize.JSON,
      field: 'details_set_by_user'
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
    hasACH (countryCodeProvided = 'CAN') {
      const countryCode = this.connection
        ? this.connection.countryCode
        : countryCodeProvided
      return countryCode === 'USA'
        ? this.number && this.routing
        : this.institution && this.transit && this.number
    },

    shouldHaveSynapseNode () {
      return (
        ['Checking', 'Savings'].includes(this.type) &&
        this.number &&
        this.routing
      )
    },

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
        name,
        nickname,
        value,
        availableBalance,
        extras,
        detailsSetByUser
      } = this.dataValues

      const connectionData = {}
      const connection = this.connection
      if (connection) {
        const { lastSync, lastGoodSync } = connection
        connectionData.sync = { lastSync, lastGoodSync }

        const institution = connection.institution
        if (institution) {
          connectionData.institution = institution.getData()
        }
      }

      let number
      let balance = value
      let dueDate
      if (detailsSetByUser) {
        const {
          fullNumber: fullNumberSetByUser,
          balance: balanceSetByUser,
          dueDate: dueDateSetByUser
        } = detailsSetByUser
        number = fullNumberSetByUser || number
        balance = balanceSetByUser || balance
        dueDate = dueDateSetByUser || dueDate
      }

      if (!number) {
        number = this.hasFullCCNumber() ? name : undefined
      }
      if (!balance || balance === 0) {
        balance = availableBalance
      }
      if (!dueDate) {
        dueDate = extras && extras.due_date ? extras.due_date : undefined
      }

      return {
        name: nickname,
        number,
        balance,
        dueDate,
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
    },

    getBalance () {
      return this.value !== 0 ? this.value : this.availableBalance
    },

    getOwnerAddress () {
      let address
      if (this.ownerDetails) {
        address = this.ownerDetails.address.data
      }

      return address
    }
  }
})
