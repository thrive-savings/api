module.exports = (Bluebird, User, Company, Bonus) => ({
  add: {
    schema: [['data', true, [['name', true]]]],
    async method (ctx) {
      const { data: { name } } = ctx.request.body

      let company = await Company.findOne({ where: { name: name.trim() } })
      if (company) return Bluebird.reject([{ key: 'company', value: 'Company with given name already exists' }])

      company = await Company.create({ name: name.trim(), code: 'placeholder' })
      await company.generateCode()

      ctx.body = { data: { name: company.name, code: company.code } }
    }
  },
  topUpUser: {
    schema: [['data', true, [['companyID', true], ['userID', true], ['amount', true]]]],
    async method (ctx) {
      const { data: { companyID, userID, amount } } = ctx.request.body
      if (amount <= 0) return Bluebird.reject([{ key: 'company', value: 'Bonus amount should be positive' }])

      const user = await User.findOne({ where: { id: userID } })

      if (!user) return Bluebird.reject([{ key: 'user', value: 'User not found' }])
      else if (user.companyID !== parseInt(companyID)) return Bluebird.reject([{ key: 'company', value: 'User and Company not matching' }])

      user.balance += parseInt(amount)
      await user.save()

      await Bonus.create({ amount, companyID, userID })

      user.sendBonusNotification(amount)

      ctx.body = {}
    }
  }
})
