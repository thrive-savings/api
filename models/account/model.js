module.exports = Sequelize => ({
  attributes: {
    // General
    bank: {
      type: Sequelize.STRING
    },
    fullName: {
      type: Sequelize.STRING,
      field: 'full_name'
    },
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
    title: {
      type: Sequelize.STRING
    },

    // Tokens
    token: {
      type: Sequelize.STRING
    },
    versapay_token: {
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

    toAuthorized () {
      const { dataValues } = this
      const bank = dataValues.bank || ''
      const title = dataValues.title || ''
      const number = dataValues.number || ''
      const transit = dataValues.transit || ''
      const { length: numberLN } = number
      const { length: transitLN } = transit

      return {
        bank,
        title,
        number:
          numberLN > 2
            ? `${Array(numberLN - 2).join('x')}${number.substring(
              numberLN - 3,
              numberLN
            )}`
            : number,
        transit:
          transitLN > 1
            ? `${Array(transitLN - 1).join('x')}-${transit.substring(
              transitLN - 2,
              transitLN
            )}`
            : transit
      }
    }
  }
})
