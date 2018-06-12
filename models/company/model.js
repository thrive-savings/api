module.exports = (Sequelize) => ({
  attributes: {
    code: {
      type: Sequelize.STRING
    },
    name: {
      type: Sequelize.STRING
    }
  },
  associations: {
    hasMany: 'User'
  },
  instanceMethods: {
    async generateCode () {
      const random = () => Math.floor(1000 + Math.random() * 9000)
      const companies = await this.constructor.findAll()
      const codes = companies.map(item => item.code.substring(item.code.length - 4))

      let code = random()
      while (codes.includes(code)) {
        code = random()
      }

      const chars = this.name.substring(0, 3).toLowerCase()
      this.code = chars + code

      await this.save()
    }
  }
})
