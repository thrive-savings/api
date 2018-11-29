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
      type: Sequelize.FLOAT,
      defaultValue: 0
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

    // Account category and type
    category: {
      type: Sequelize.STRING
    },
    type: {
      type: Sequelize.STRING
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
      type: Sequelize.INTEGER,
      field: 'quovo_account_id'
    },

    // DB refs
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
