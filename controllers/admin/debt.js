module.exports = (Institution, Connection, Account, Debt, request, config) => ({
  create: {
    schema: [
      ['data', true, [['accountID', true, 'integer'], ['replyData', 'boolean']]]
    ],
    async method (ctx) {
      const {
        data: { accountID, replyData }
      } = ctx.request.body
      const reply = {}

      try {
        const account = await Account.findOne({
          include: [Connection],
          where: { id: accountID }
        })
        if (account) {
          const debtData = {
            userID: account.userID,
            accountID
          }

          let debt = await Debt.findOne({ where: { accountID } })
          if (!debt) {
            debt = await Debt.create(debtData)
          } else {
            debt.update(debtData)
          }

          if (replyData) {
            const { data: debtData } = await request.post({
              uri: `${config.constants.URL}/admin/debt-fetch`,
              body: {
                secret: process.env.apiSecret,
                data: {
                  debtID: debt.id
                }
              },
              json: true
            })
            reply.data = debtData
          }
        } else {
          reply.error = true
          reply.errorCode = 'account_not_found'
        }
      } catch (e) {
        reply.error = true
      }

      ctx.body = reply
    }
  },

  fetch: {
    schema: [['data', true, [['debtID', true, 'integer']]]],
    async method (ctx) {
      const {
        data: { debtID }
      } = ctx.request.body
      const reply = {}

      try {
        const debt = await Debt.findOne({ where: { id: debtID } })
        if (debt) {
          const debtData = debt.getData()
          console.log(debtData)
          if (debt.accountID) {
            const account = await Account.findOne({
              include: [{ model: Connection, include: [Institution] }],
              where: { id: debt.accountID }
            })
            if (account) {
              debtData.account = account.getDebtData()
            }
          }

          reply.data = debtData
        } else {
          reply.error = true
          reply.errorCode = 'debt_not_found'
        }
      } catch (e) {
        reply.error = true
      }

      ctx.body = reply
    }
  }
})
