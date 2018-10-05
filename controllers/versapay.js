// const crypto = require('crypto')

module.exports = (User, Account, Queue, Goal, amplitude) => ({
  hook: {
    async method (ctx) {
      const req = ctx.request.body
      if (req.type === 'transaction') {
        /*
        // Verify signature
        let sortedKeys = ''
        Object.keys(req).sort().forEach(key => {
          if (key !== 'signature') {
            sortedKeys += (key + '' + req[key])
          }
        }) // ${config.constants.URL}
        const requestString = `POST\nhttps://b5ae5bc6.ngrok.io/versapay-hook\n${sortedKeys}`
        console.log('-------------START PRINTING SORTED KEYS--------------')
        console.log(requestString)
        console.log('-------------DONE PRINTING SORTED KEYS--------------')
        const hash = crypto.createHmac('sha256', process.env.versaPayHookSecret).update(requestString).digest('hex')
        const expectedSignature = encodeURI(Buffer.from(hash).toString('base64'))
        console.log(expectedSignature)
        */
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
          const savedQueue = await queue.save()

          const accountToken =
            transactionType === 'direct_debit'
              ? req.from_fund_token
              : req.to_fund_token
          const account = await Account.findOne({
            where: { id: savedQueue.accountID }
          })
          if (account.versapay_token !== accountToken) {
            account.versapay_token = accountToken
            await account.save()
          }

          if (state === 'in_progress' || state === 'completed') {
            const user = await User.findOne({
              where: { id: savedQueue.userID }
            })

            if (state === 'completed') {
              await user.updateBalance(amountInCents, transactionType)
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
