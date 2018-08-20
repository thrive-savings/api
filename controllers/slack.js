module.exports = (Bluebird, User, amplitude, twilio, request, config) => ({
  sendSms: {
    async method (ctx) {
      const requestBody = ctx.request.body
      const { text } = requestBody

      let [phone, ...msg] = text.split(' ')

      // Find user by phone
      let user = await User.findOne({ where: { phone } })
      if (!user) {
        user = await User.findOne({ where: { phone: phone.substr(2) } })
      }

      let slackMsg = ''
      if (user) {
        msg = msg.join(' ')
        twilio.messages.create({
          from: process.env.twilioNumber,
          to: user.phone,
          body: msg
        })

        slackMsg = `Reply from Thrive to ${user.phone} | ${user.firstName} ${
          user.lastName
        } | ${msg}`
        amplitude.track({
          eventType: 'BOT SENT MESSAGE',
          userId: user.id,
          eventProperties: {
            Message: msg,
            Phone: user.phone,
            'Message Type': 'Manual'
          }
        })
      } else {
        slackMsg = `Error: user with phone ${phone} not found`
      }

      if (slackMsg) {
        await request.post({
          uri: process.env.slackWebhookURL,
          body: { text: slackMsg },
          json: true
        })
      }

      ctx.body = ''
    }
  },

  addCompany: {
    async method (ctx) {
      let { text: companyNames } = ctx.request.body
      companyNames = companyNames.split(',')

      let slackMsg = 'Company Added '
      for (const companyName of companyNames) {
        if (companyName) {
          const {
            data: { code: companyCode }
          } = await request.post({
            uri: `${config.constants.URL}/admin/company-add`,
            body: {
              secret: process.env.apiSecret,
              data: { name: companyName.toString() }
            },
            json: true
          })
          slackMsg += `| Name: ${companyName} - Code: ${companyCode} `
        }
      }

      if (slackMsg) {
        await request.post({
          uri: process.env.slackWebhookURL,
          body: { text: slackMsg },
          json: true
        })
      }

      ctx.body = ''
    }
  },

  requestApproval: {
    schema: [
      ['data', true, [['userID', true, 'integer'], ['amount', true, 'integer']]]
    ],
    async method (ctx) {
      const {
        data: { userID, amount }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: userID } })
      if (!user) {
        return Bluebird.reject([
          { key: 'user', value: `User not found for ID: ${userID}` }
        ])
      }

      const getDollarString = amount => {
        let dollars = amount / 100
        dollars = dollars % 1 === 0 ? dollars : dollars.toFixed(2)
        dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
        return dollars
      }

      await request.post({
        uri: process.env.slackWebhookURL,
        body: {
          text: `Algorithm has choosen $${getDollarString(
            amount
          )} to transfer for ${user.firstName} | ${user.phone} | ID${user.id}`,
          attachments: [
            {
              title: 'Do you approve?',
              fallback: 'You are unable to approve the request',
              callback_id: `approvalRequest_${userID}_${amount}`,
              color: '#2CC197',
              actions: [
                {
                  name: 'yes',
                  text: 'Yes',
                  type: 'button',
                  style: 'danger',
                  value: 'yes'
                },
                {
                  name: 'no',
                  text: 'No',
                  type: 'button',
                  value: 'no'
                },
                {
                  name: 'auto',
                  text: "Don't ask again",
                  type: 'button',
                  value: 'auto'
                }
              ]
            }
          ]
        },
        json: true
      })

      ctx.body = {}
    }
  },

  interaction: {
    async method (ctx) {
      const {
        actions: [{ value }],
        callback_id: callbackId,
        original_message: originalMessage
      } = JSON.parse(ctx.request.body.payload)

      const [command, ...params] = callbackId.split('_')

      let replyMessage = originalMessage
      if (command === 'approvalRequest') {
        replyMessage = await request.post({
          uri: `${config.constants.URL}/admin/worker-handle-approval`,
          body: {
            secret: process.env.apiSecret,
            data: {
              value,
              params,
              originalMessage
            }
          },
          json: true
        })
      }

      ctx.body = replyMessage
    }
  }
})
