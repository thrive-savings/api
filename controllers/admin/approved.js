module.exports = (Bluebird, User, request, config) => ({
  algoResult: {
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

      const [, userID, amount] = callbackId.split('_')

      const user = await User.findOne({ where: { id: userID } })
      if (!user) {
        return Bluebird.reject([
          { key: 'user', value: `User not found for ID: ${userID}` }
        ])
      }

      let replyMessage = Object.assign({}, originalMessage)
      replyMessage.attachments = []

      if (value === 'yes') {
        request.post({
          uri: `${config.constants.URL}/admin/worker-transfer`,
          body: {
            secret: process.env.apiSecret,
            data: {
              userID: parseInt(userID),
              amount: parseInt(amount),
              type: 'debit',
              requestMethod: 'AutomatedApproved'
            }
          },
          json: true
        })
        replyMessage.text += '\n*Proceeding the transfer.*'
      } else if (value === 'no') {
        replyMessage.text += '\n*Transfer cancelled.*'
      } else if (value === 'auto') {
        user.update({ requireApproval: false })
        replyMessage.text += '\n*Understood.*'
      } else {
        request.post({
          uri: `${config.constants.URL}/slack-api-call`,
          body: {
            data: {
              url: 'dialog.open',
              body: {
                dialog: JSON.stringify({
                  callback_id: `changeAmount_${userID}`,
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
    }
  }
})
