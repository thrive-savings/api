module.exports = Sequelize => ({
	up (queryInterface) {
		return queryInterface
			.addColumn(
				'queues',
				'uuid',
				{
					type: Sequelize.STRING
				}
			)
	}
})
