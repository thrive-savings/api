module.exports = (User, request, amplitude, config) => ({
  transfer: {
    schema: [
      [
        'data',
        true,
        [
          ['userID', true, 'integer'],
          ['amount', true, 'integer'],
          ['type', true],
          ['requestMethod', true]
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { userID, amount, type, requestMethod }
      } = ctx.request.body

      const reply = {}
      const user = await User.findOne({ where: { id: userID } })

      if (user) {
        try {
          // Create queue entry
          await request.post({
            uri: `${config.constants.URL}/admin/queue-create`,
            body: {
              secret: process.env.apiSecret,
              data: { userID, amountInCents: amount, type, requestMethod }
            },
            json: true
          })

          // Deposit to VersaPay
          await request.post({
            uri: `${config.constants.URL}/admin/versapay-sync`,
            body: { secret: process.env.apiSecret, data: { userID } },
            json: true
          })

          amplitude.track({
            eventType: 'WORKER_TRANSFER_DONE',
            userId: userID,
            eventProperties: {
              Amount: amount,
              TransactionType: type,
              RequestMethod: requestMethod
            }
          })
        } catch (error) {
          amplitude.track({
            eventType: 'WORKER_TRANSFER_FAIL',
            userId: user.id,
            eventProperties: { error }
          })
        }
      } else {
        reply.error = true
        amplitude.track({
          eventType: 'WORKER_TRANSFER_FAIL',
          userId: 'server',
          eventProperties: {
            Error: `User ${userID} was not found.`
          }
        })
      }

      ctx.body = reply
    }
  }
})
