module.exports = Sequelize => ({
	up (queryInterface) {
		return queryInterface
			.addColumn(
				'accounts',
				'versapay_token',
				{
					type: Sequelize.STRING
				}
			)
	}
})
