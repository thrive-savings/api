module.exports = (User, Account, Queue, request) => ({
  hook: {
    async method (ctx) {
      const req = ctx.request.body

      if (req.type === 'transaction') {
        // TODO: Verify signature

        const {
          token,
          state,
          transaction_type: transactionType,
          unique_reference: uuid,
          amount_in_cents: amountInCents
        } = req

        const queue = await Queue.findOne({ where: { uuid } })
        if (queue) {
          if (!queue.processed) queue.processed = true
          if (!queue.processedDate) queue.processedDate = Date.now()
          if (!queue.versapay_token) queue.versapay_token = token
          queue.state = state
          await queue.save()

          if (queue.requestMethod !== 'ManualDirect') {
            const accountToken =
              transactionType === 'direct_debit'
                ? req.from_fund_token
                : req.to_fund_token

            const account = await Account.findOne({
              where: { id: queue.accountID }
            })
            if (account && account.versapay_token !== accountToken) {
              account.versapay_token = accountToken
              await account.save()
            }
          }

          if (state === 'in_progress' || state === 'completed') {
            const user = await User.findOne({
              where: { id: queue.userID }
            })

            if (
              state === 'in_progress' &&
              ['Manual', 'ManualDirect'].includes(queue.requestMethod)
            ) {
              await request.post({
                uri: process.env.slackWebhookURL,
                body: {
                  text: `Transaction [QueueID: ${
                    queue.id
                  }] Initiated for User ${user.id}`
                },
                json: true
              })
            }

            if (state === 'completed') {
              await user.updateBalance(
                amountInCents,
                transactionType === 'direct_debit' ? 'debit' : 'credit'
              )
            }

            user.notifyUserAboutTransaction(
              transactionType,
              state,
              amountInCents
            )
          }
        }
      }

      ctx.body = {}
    }
  }
})
