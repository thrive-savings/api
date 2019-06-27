module.exports = (
  Bluebird,
  User,
  Transfer,
  request,
  config,
  amplitude,
  Sentry,
  moment,
  ConstantsService
) => ({
  transferAmount: {
    schema: [['data', true, [['payload', true, 'object']]]],
    async method (ctx) {
      const {
        data: { payload }
      } = ctx.request.body

      const {
        actions: [{ value }],
        original_message: originalMessage,
        callback_id: callbackId,
        trigger_id,
        response_url: responseUrl
      } = payload

      const [, transferID] = callbackId.split('_')

      const transfer = await Transfer.findOne({ where: { id: transferID } })
      if (!transfer) {
        return Bluebird.reject([
          {
            key: 'transfer_not_found',
            value: `Transfer not found for ID: ${transferID}`
          }
        ])
      }

      amplitude.track({
        eventType: 'TRANSFER_APPROVAL_REQUEST_RETURNED',
        userId: transfer.userID,
        eventProperties: {
          Value: `${value}`
        }
      })

      let replyMessage = Object.assign({}, originalMessage)
      replyMessage.attachments = []

      const { STATES, APPROVAL_STATES } = ConstantsService.TRANSFER

      const timeline = transfer.timeline
      const date = moment()

      if (value === 'yes') {
        const timelineEntry = {
          note: 'Admin approved the transfer',
          state: STATES.QUEUED,
          date
        }
        timeline.push(timelineEntry)
        await transfer.update({
          timeline,
          state: timelineEntry.state,
          approvalState: APPROVAL_STATES.ADMIN_APPROVED
        })
        request.post({
          uri: `${config.constants.URL}/admin/transfer-process`,
          body: {
            secret: process.env.apiSecret,
            data: {
              transferID: transfer.id
            }
          },
          json: true
        })
        replyMessage.text += '\n*Processing the transfer.*'
      } else if (value === 'no') {
        const timelineEntry = {
          note: 'Admin canceled the transfer',
          state: STATES.CANCELED,
          date
        }
        timeline.push(timelineEntry)
        await transfer.update({
          timeline,
          state: timelineEntry.state,
          approvalState: APPROVAL_STATES.ADMIN_UNAPPROVED
        })
        replyMessage.text += '\n*Transfer cancelled.*'
      } else {
        request.post({
          uri: `${config.constants.URL}/slack-api-call`,
          body: {
            data: {
              url: 'dialog.open',
              body: {
                dialog: JSON.stringify({
                  callback_id: `changeTransferAmount_${transferID}`,
                  title: 'Choose a new amount',
                  submit_label: 'Transfer',
                  elements: [
                    {
                      type: 'text',
                      label: 'Amount:',
                      name: 'amount',
                      hint: 'Example amount format: 10.25',
                      max_length: 6,
                      min_length: 1
                    }
                  ],
                  state: responseUrl
                }),
                trigger_id
              }
            }
          },
          json: true
        })
        replyMessage = originalMessage
      }

      ctx.body = replyMessage
    }
  },

  unlinkText: {
    schema: [['data', true, [['payload', true, 'object']]]],
    async method (ctx) {
      const {
        data: { payload }
      } = ctx.request.body

      const {
        actions: [{ value }],
        original_message: originalMessage,
        callback_id: callbackId
      } = payload

      const [, userID] = callbackId.split('_')

      const user = await User.findOne({ where: { id: userID } })
      if (!user) {
        return Bluebird.reject([
          { key: 'user', value: `User not found for ID: ${userID}` }
        ])
      }

      let replyMessage = Object.assign({}, originalMessage)
      replyMessage.attachments = []

      if (value === 'yes') {
        user.sendMessage(originalMessage.attachments[0].text)
        replyMessage.text += '\n*Sending the notification text*'
      } else if (value === 'no') {
        replyMessage.text += '\n*Not notifying user.*'
      }

      ctx.body = replyMessage
    },
    onError (err) {
      Sentry.captureException(err)
    }
  }
})
