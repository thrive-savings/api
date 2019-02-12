module.exports = (
  Sequelize,
  Account,
  Debt,
  Bluebird,
  request,
  config,
  moment
) => ({
  fetch: {
    async method (ctx) {
      const userID = ctx.authorized.id
      const debts = []
      const accountIDs = []

      const debtInstances = await Debt.findAll({
        where: { userID }
      })
      for (const { id: debtID, accountID } of debtInstances) {
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
  },

  saveDetails: {
    schema: [
      [
        'data',
        true,
        [
          ['debtID', true, 'integer'],
          ['fullNumber'],
          ['balance', 'integer'],
          ['dueDate'],
          ['accelerateAmount', 'integer'],
          ['accelerateOn', 'boolean']
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: {
          debtID,
          fullNumber,
          balance,
          dueDate,
          accelerateAmount,
          accelerateOn
        }
      } = ctx.request.body

      console.log({
        debtID,
        fullNumber,
        balance,
        dueDate,
        accelerateAmount,
        accelerateOn
      })

      const debt = await Debt.findOne({ where: { id: debtID } })
      if (!debt) {
        return Bluebird.reject([
          {
            key: 'debt_not_found',
            value: `No debt instance found for id ${debtID}`
          }
        ])
      }

      if (accelerateAmount || accelerateOn) {
        if (accelerateAmount) {
          debt.accelerateAmount = accelerateAmount
        }
        if (accelerateOn) {
          debt.accelerateOn = accelerateOn
        }
        await debt.save()
      }

      const account = await Account.findOne({ where: { id: debt.accountID } })
      if (account) {
        if (fullNumber || balance || dueDate) {
          const detailsSetByUser = {}
          if (fullNumber) {
            detailsSetByUser.fullNumber = fullNumber
          }
          if (balance) {
            detailsSetByUser.balance = -1 * Math.abs(balance)
          }
          if (dueDate) {
            detailsSetByUser.dueDate = moment(dueDate)
          }
          account.detailsSetByUser = detailsSetByUser
          await account.save()
        }
      }

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

      ctx.body = { debt: debtData }
    }
  }
})
