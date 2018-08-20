module.exports = (User, Account, Queue, request, Bluebird, amplitude) => ({
  sync: {
    schema: [['data', true, [['userID', 'integer']]]],
    async method (ctx) {
      const {
        data: { userID: providedUserID }
      } = ctx.request.body

      try {
        const whereClause = { processed: false }
        if (providedUserID) {
          whereClause.userID = providedUserID
        }
        const queues = await Queue.findAll({ where: whereClause })

        queues.forEach(async queue => {
          const {
            type,
            amount,
            userID,
            accountID,
            transactionReference,
            uuid
          } = queue
          const user = await User.findOne({ where: { id: userID } })

          if (type === 'credit' && user.balance < amount) {
            queue.processed = true
            queue.processedDate = Date.now()
            await queue.save()
            user.notifyUserAboutTransaction(type, 'invalid_amount', amount)
          } else {
            let body = {
              amount_in_cents: amount,
              transaction_type: `direct_${type}`,
              transaction_reference: transactionReference,
              unique_reference: uuid,
              email: user.email,
              first_name: user.firstName,
              last_name: user.lastName,
              fund_token: process.env.versaPayFundToken
            }

            let account
            if (accountID) {
              account = await Account.findOne({ where: { id: accountID } })
            } else {
              account = await Account.findOne({
                where: { userID, isDefault: true }
              })
              queue.accountID = account.id
              await queue.save()
            }

            if (account.versapay_token) {
              if (type === 'debit') {
                body.from_fund_token = account.versapay_token
              } else body.to_fund_token = account.versapay_token
            } else {
              body.institution_number = account.institution
              body.branch_number = account.transit
              body.account_number = account.number
            }

            await request.post({
              uri: `${process.env.versaPayApiURL}/api/transactions`,
              auth: {
                user: process.env.versaPayToken,
                pass: process.env.versaPayKey
              },
              body,
              json: true
            })
          }
        })

        ctx.body = {
          data: {
            message: `Versapay successfully synced for #${
              queues.length
            } of transfers`
          }
        }
      } catch (error) {
        console.log('------Catched inside VERSAPAY_SYNC------')
        amplitude.track({
          eventType: 'VERSAPAY_SYNC_FAIL',
          userId: providedUserID || 'server',
          eventProperties: { error }
        })
        ctx.body = { error: true }
      }
    }
  }
})
