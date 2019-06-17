module.exports = (Sequelize, config, moment) => ({
  up (queryInterface) {
    const {
      TYPES,
      SUBTYPES,
      STATES,
      REQUEST_METHODS,
      APPROVAL_STATES
    } = config.constants.TRANSFER

    return queryInterface
      .createTable('transfers', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          field: 'id'
        },

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
              note: 'Transfer is created on Thrive side',
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
      })
      .then(() => queryInterface.addIndex('transfers', ['user_id']))
  },
  down (queryInterface) {
    return queryInterface
      .dropTable('transfers')
      .then(() => queryInterface.removeIndex('transfers', ['user_id']))
  }
})
