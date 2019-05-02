module.exports = Sequelize => ({
  attributes: {
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
  },
  indexes: [{ fields: ['source_id', 'target_id'] }],
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
})
