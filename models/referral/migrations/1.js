module.exports = Sequelize => ({
  up (queryInterface) {
    return queryInterface
      .createTable('referrals', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          field: 'id'
        },
        sourceID: {
          type: Sequelize.INTEGER,
          allowNull: false,
          field: 'source_id',
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        targetID: {
          type: Sequelize.INTEGER,
          allowNull: false,
          field: 'target_id',
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        status: {
          type: Sequelize.ENUM,
          values: ['rewarded', 'waiting'],
          defaultValue: 'waiting'
        },
        createdAt: {
          type: Sequelize.DATE,
          field: 'created_at'
        },
        updatedAt: {
          type: Sequelize.DATE,
          field: 'updated_at'
        }
      })
      .then(() =>
        queryInterface.addIndex('referrals', ['source_id', 'target_id'])
      )
  },
  down (queryInterface) {
    return queryInterface
      .dropTable('referrals')
      .then(() =>
        queryInterface.removeIndex('referrals', ['source_id', 'target_id'])
      )
  }
})
