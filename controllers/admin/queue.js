module.exports = (Account, Queue, moment, amplitude, Sentry) => ({
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
          ['requestMethod', true],
          ['processed', 'boolean']
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
          requestMethod,
          processed: alreadyProcessed
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

          const alreadyRan = alreadyProcessed || type === 'bonus'
          await Queue.create({
            userID,
            accountID,
            amount: amountInCents,
            type,
            requestMethod,
            transactionReference,
            processed: alreadyRan,
            state: alreadyRan ? 'completed' : null
          })

          ctx.body = {}
        } catch (error) {
          Sentry.captureException(error)

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
