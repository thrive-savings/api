module.exports = (
  User,
  Account,
  Transfer,
  config,
  moment,
  amplitude,
  request
) => {
  const {
    TRANSFER: { STATES }
  } = config.constants

  return {
    versapay: {
      async method (ctx) {
        console.log(ctx.request.body)

        const reply = {}
        try {
          const {
            type,
            token,
            state: stateRaw,
            transaction_type: transactionType,
            unique_reference: uuid,
            from_fund_token: fromFundToken,
            to_fund_token: toFundToken
          } = ctx.request.body

          if (type === 'transaction') {
            const transfer = await Transfer.findOne({
              include: [User],
              where: { uuid }
            })
            if (transfer) {
              reply.transferID = transfer.id
              reply.userID = transfer.userID
              reply.stateRaw = stateRaw

              const timeline = transfer.timeline
              const timelineEntry = { date: moment(), stateRaw }
              let state = transfer.state
              switch (stateRaw) {
                case 'in_progress':
                  state = STATES.PROCESSING
                  timelineEntry.note = 'Getting processed by the provider'
                  break
                case 'completed':
                  state = STATES.COMPLETED
                  timelineEntry.note = 'Settled'
                  break
                case 'cancelled':
                  state = STATES.CANCELED
                  timelineEntry.note = 'Canceled through the provider'
                  break
                case 'error':
                  state = STATES.FAILED
                  timelineEntry.note = 'Failed to process by the provider'
                  break
                case 'rejected':
                case 'nsfed':
                case 'completed_but_nsfed':
                  state = STATES.RETURNED
                  timelineEntry.note = 'Rejected through the provider'
                  break
                default:
                  timelineEntry.note =
                    'Unhandled state is passed to the webhook'
              }
              timelineEntry.state = state
              timeline.push(timelineEntry)

              transfer.timeline = timeline
              transfer.state = state
              transfer.stateRaw = stateRaw
              transfer.platformID = token
              await transfer.save()

              const { user, amount, type, subtype } = transfer

              // Set VersaPay Token for Account
              const accountID = transfer.getCanadianAccountID()
              console.log(accountID)
              const accountVersapayToken =
                transactionType === 'direct_debit' ? fromFundToken : toFundToken
              const account = await Account.findOne({
                where: { id: accountID }
              })
              if (account && account.versapay_token !== accountVersapayToken) {
                account.versapay_token = accountVersapayToken
                await account.save()
              }

              // Update & Notify User
              if ([STATES.COMPLETED, STATES.PROCESSING].includes(state)) {
                if (state === STATES.COMPLETED) {
                  user.updateBalance(amount, type)
                }
                user.notifyAboutTransfer(amount, subtype, state)
              } else if (stateRaw === 'completed_but_nsfed') {
                user.undoBalanceUpdate(amount, type)
              }
            } else {
              reply.error = true
              reply.errorCode = 'transfer_not_found'
              reply.uuid = uuid
            }
          }
        } catch (e) {
          reply.error = true
          reply.errorCode = 'try_catched'
          reply.errorData = e
          console.log(e)
        }

        amplitude.track({
          eventType: `VERSAPAY_HOOK_${reply.error ? 'FAIL' : 'SUCCEED'}`,
          userId: reply.userID ? reply.userID : 'server',
          eventProperties: reply
        })
        request.post({
          uri: process.env.slackWebhookURL,
          body: {
            text: `VersaPay Hook: *${
              reply.error
                ? `FAIL - ${reply.errorCode}${
                  reply.errorMessage ? ` - ${reply.errorMessage}` : ''
                }`
                : `SUCCEED`
            }*${reply.stateRaw ? ` | State: *${reply.stateRaw}*` : ''}${
              reply.transferID ? ` | Transfer ${reply.transferID}` : ''
            }${reply.userID ? ` | User ${reply.userID}` : ''}`
          },
          json: true
        })

        ctx.body = reply
      }
    }
  }
}
