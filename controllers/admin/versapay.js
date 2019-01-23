module.exports = (User, Account, Queue, request, Sentry, amplitude) => ({
  sync: {
    schema: [
      [
        'data',
        true,
        [['userID', 'integer'], ['institution'], ['transit'], ['account']]
      ]
    ],
    async method (ctx) {
      const {
        data: {
          userID: providedUserID,
          institution: providedInstitution,
          transit: providedTransit,
          account: providedAccount
        }
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
              if (account) {
                queue.accountID = account.id
                await queue.save()
              }
            }

            if (providedInstitution && providedTransit && providedAccount) {
              body.institution_number = providedInstitution
              body.branch_number = providedTransit
              body.account_number = providedAccount
            } else if (account) {
              if (account.versapay_token) {
                if (type === 'debit') {
                  body.from_fund_token = account.versapay_token
                } else body.to_fund_token = account.versapay_token
              } else {
                body.institution_number = account.institution
                body.branch_number = account.transit
                body.account_number = account.number
              }
            }

            try {
              await request.post({
                uri: `${process.env.versaPayApiURL}/api/transactions`,
                auth: {
                  user: process.env.versaPayToken,
                  pass: process.env.versaPayKey
                },
                body,
                json: true
              })
            } catch ({ error, message }) {
              await request.post({
                uri: process.env.slackWebhookURL,
                body: {
                  text: `Versapay API error for User ${user.id}:\n${message} `
                },
                json: true
              })

              queue.processed = true
              queue.processedDate = Date.now()
              queue.state = 'failed'
              await queue.save()

              Sentry.captureException(error)

              amplitude.track({
                eventType: 'VERSAPAY_API_FAIL',
                userId: user.id,
                eventProperties: { error }
              })
            }
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
        Sentry.captureException(error)

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
