module.exports = (Sequelize) => ({
  attributes: {
    bank: {
      type: Sequelize.STRING
    },
    fullName: {
      type: Sequelize.STRING,
      field: 'full_name'
    },
    firstName: {
      type: Sequelize.STRING,
      field: 'first_name'
    },
    lastName: {
      type: Sequelize.STRING,
      field: 'last_name'
    },
    institution: {
      type: Sequelize.STRING
    },
    isDefault: {
      type: Sequelize.BOOLEAN,
      field: 'is_default'
    },
    number: {
      type: Sequelize.STRING
    },
    title: {
      type: Sequelize.STRING
    },
    token: {
      type: Sequelize.STRING
    },
    transit: {
      type: Sequelize.STRING
    },
    type: {
      type: Sequelize.STRING
    },
    versapay_token: {
      type: Sequelize.STRING
    }
  },
  associations: {
    belongsTo: 'User',
    hasMany: 'Transaction'
  },
  indexes: [
    { fields: ['user_id'] }
  ],
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
        number: numberLN > 2 ? `${Array(numberLN - 2).join('x')}${number.substring(numberLN - 3, numberLN)}` : number,
        transit: transitLN > 1 ? `${Array(transitLN - 1).join('x')}-${transit.substring(transitLN - 2, transitLN)}` : transit
      }
    }
  }
})
