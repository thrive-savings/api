module.exports = (User, Account, Queue, Sequelize, moment, amplitude) => ({
  create: {
    schema: [
      [
        'data',
        true,
        [
          ['userID', true, 'integer'],
          ['accountID', 'integer'],
          ['amountInCents', true, 'integer'],
          ['type', true],
          ['requestMethod', true]
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: {
          userID,
          accountID: providedAccountID,
          amountInCents,
          type,
          requestMethod
        }
      } = ctx.request.body

      if (userID && amountInCents && type) {
        try {
          let accountID = providedAccountID
          if (!accountID) {
            const account = await Account.findOne({
              where: { userID, isDefault: true }
            })
            accountID = account.id
          }
          const transactionReference = `THRIVE${userID}_` + moment().format('X')
          await Queue.create({
            userID,
            accountID,
            amount: amountInCents,
            type,
            requestMethod,
            transactionReference
          })

          ctx.body = { data: { sucess: true } }
        } catch (error) {
          console.log('------Catched inside QUEUE_CREATE------')
          amplitude.track({
            eventType: 'QUEUE_CREATE_FAIL',
            userId: userID,
            eventProperties: { error }
          })
          ctx.body = { error: true }
        }
      }
    }
  }
})
