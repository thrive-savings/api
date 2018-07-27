module.exports = (User, request, amplitude, config) => ({
  run: {
    schema: [['data', true, [['frequencyWord', true]]]],
    async method (ctx) {
      const { frequencyWord } = ctx.request.body.data

      const BALANCE_LOWER_THRESHOLD = 15000
      const MAX_DEPOSIT_AMOUNT = 100000

      const users = await User.findAll({ where: { fetchFrequency: frequencyWord } })
      const runTime = new Date()
      amplitude.track({
        eventType: 'WORKER_RUN',
        deviceId: 'server',
        eventProperties: {
          Frequency: `${frequencyWord}`, UserCount: `${users.length}`
        }
      })

      if (users.length > 0) {
        for (const user of users) {
          if (user.bankLinked) {
            // Fetch new transactions for user
            const { data: { balance } } = await request.post({
              uri: `${config.constants.URL}/admin/transactions-fetch-user`,
              body: { secret: process.env.apiSecret, data: { userID: user.id } },
              json: true
            })

            amplitude.track({
              eventType: 'WORKER_GOT_BALANCE',
              userId: user.id,
              eventProperties: {
                Frequency: `${frequencyWord}`, SavingType: `${user.savingType}`, Balance: `${balance}`
              }
            })

            // Get  saving amount
            let amount
            if (user.savingType === 'Thrive Flex') {
              const algoResult = await request.post({
                uri: `${config.constants.URL}/admin/algo-run`,
                body: { secret: process.env.apiSecret, data: { userID: user.id } },
                json: true
              })
              amount = algoResult.amount
            } else {
              amount = user.fixedContribution
            }

            amplitude.track({
              eventType: 'WORKER_GOT_AMOUNT',
              userId: user.id,
              eventProperties: {
                Frequency: `${frequencyWord}`, UserID: `${user.id}`, SavingType: `${user.savingType}`, Amount: `${amount}`, Balance: `${balance}`
              }
            })

            // Transfer the amount
            if (balance > BALANCE_LOWER_THRESHOLD && amount < MAX_DEPOSIT_AMOUNT) {
              await request.post({
                uri: `${config.constants.URL}/admin/worker-transfer`,
                body: { secret: process.env.apiSecret, data: { userID: user.id, amount, type: 'debit', requestMethod: 'Automated' } },
                json: true
              })
            }
          }
        }
      }

      ctx.body = {}
    },
    onError (error) {
      amplitude.track({
        eventType: 'WORKER_RUN_FAIL',
        deviceId: "server",
        eventProperties: { error }
      })
    }
  },
  transfer: {
    schema: [['data', true, [['userID', true], ['amount', true], ['type', true], ['requestMethod', true]]]],
    async method (ctx) {
      const { data: { userID, amount, type, requestMethod } } = ctx.request.body

      // Create queue entry
      await request.post({
        uri: `${config.constants.URL}/admin/queue-create`,
        body: { secret: process.env.apiSecret, data: { userID, amountInCents: amount, type, requestMethod } },
        json: true
      })

      // Deposit to VersaPay
      await request.post({
        uri: `${config.constants.URL}/admin/versapay-sync`,
        body: { secret: process.env.apiSecret, data: { userID } },
        json: true
      })

      amplitude.track({

      })

      ctx.body = {}
    },
    onError (error) {
      amplitude.track({
        eventType: 'WORKER_TRANSFER_FAIL',
        deviceId: "server",
        eventProperties: { error }
      })
    }
  }
})
