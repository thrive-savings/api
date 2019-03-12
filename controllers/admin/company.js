module.exports = (
  Bluebird,
  User,
  Company,
  Bonus,
  request,
  config,
  amplitude
) => ({
  add: {
    schema: [['data', true, [['name', true]]]],
    async method (ctx) {
      const {
        data: { name }
      } = ctx.request.body

      let company = await Company.findOne({ where: { name: name.trim() } })
      if (company) {
        return Bluebird.reject([
          { key: 'company', value: 'Company with given name already exists' }
        ])
      }

      company = await Company.create({ name: name.trim(), code: 'placeholder' })
      await company.generateCode()

      ctx.body = { data: { name: company.name, code: company.code } }
    }
  },

  topUpUser: {
    schema: [
      [
        'data',
        true,
        [
          ['companyID', true, 'integer'],
          ['userID', true, 'integer'],
          ['amount', true, 'integer']
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { companyID, userID, amount }
      } = ctx.request.body
      if (amount <= 0) {
        return Bluebird.reject([
          { key: 'company', value: 'Bonus amount should be positive' }
        ])
      }

      const user = await User.findOne({ where: { id: userID } })

      if (!user) {
        return Bluebird.reject([{ key: 'user', value: 'User not found' }])
      } else if (user.companyID !== parseInt(companyID)) {
        return Bluebird.reject([
          { key: 'company', value: 'User and Company not matching' }
        ])
      }

      const reply = {}
      try {
        await request.post({
          uri: `${config.constants.URL}/admin/queue-create`,
          body: {
            secret: process.env.apiSecret,
            data: {
              userID,
              amountInCents: amount,
              type: 'bonus',
              requestMethod: 'EmployerBonus'
            }
          },
          json: true
        })
        await Bonus.create({ amount, companyID, userID })

        await user.updateBalance(amount, 'debit')
        user.sendBonusNotification(amount)

        amplitude.track({
          eventType: 'BONUS_USER_SUCCEED',
          userId: userID,
          eventProperties: {
            CompanyID: companyID,
            Amount: amount
          }
        })
      } catch (e) {
        reply.error = true
        amplitude.track({
          eventType: 'BONUS_USER_FAIL',
          userId: userID,
          eventProperties: {
            CompanyID: companyID,
            Amount: amount,
            Error: e
          }
        })
      }

      ctx.body = reply
    }
  }
})
