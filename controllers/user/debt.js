module.exports = (Sequelize, Account, Debt, request, config) => ({
  fetch: {
    async method (ctx) {
      const userID = ctx.authorized.id
      const debts = []
      const accountIDs = []

      const debtInstances = await Debt.findAll({
        where: { userID }
      })
      for (const { id: debtID, accountID } of debtInstances) {
        console.log('--Looping Debts--')
        const { data: debtData } = await request.post({
          uri: `${config.constants.URL}/admin/debt-fetch`,
          body: {
            secret: process.env.apiSecret,
            data: {
              debtID
            }
          },
          json: true
        })
        debts.push(debtData)
        accountIDs.push(accountID)
      }

      // Making sure all Credit Cards have corresponding Debt entry
      const otherCCs = await Account.findAll({
        where: {
          id: { [Sequelize.Op.notIn]: accountIDs },
          type: 'Credit Card',
          userID
        }
      })
      if (otherCCs && otherCCs.length > 0) {
        for (const { id: ccAccountID } of otherCCs) {
          const { data: debtData } = await request.post({
            uri: `${config.constants.URL}/admin/debt-create`,
            body: {
              secret: process.env.apiSecret,
              data: {
                accountID: ccAccountID,
                replyData: true
              }
            },
            json: true
          })
          debts.push(debtData)
        }
      }

      console.log(debts)
      ctx.body = { debts }
    }
  }
})
