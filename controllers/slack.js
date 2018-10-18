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

  apiCall: {
    schema: [['data', true, [['url', true], ['body', true, 'object']]]],
    async method (ctx) {
      const {
        data: { url, body }
      } = ctx.request.body

      await request.post({
        uri: `${config.constants.SLACK_API_URL}/${url}`,
        headers: {
          Authorization: `Bearer ${process.env.slackApiKey}`
        },
        body,
        json: true
      })

      ctx.body = {}
    }
  },

  requestNotificationApproval: {
    schema: [
      [
        'data',
        true,
        [['userID', true, 'integer'], ['text', true], ['uri', 'string']]
      ]
    ],
    async method (ctx) {
      const {
        data: { userID, text, uri }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: userID } })
      if (!user) {
        return Bluebird.reject([
          { key: 'user', value: `User not found for ID: ${userID}` }
        ])
      }

      await request.post({
        uri: uri || process.env.slackWebhookURL,
        body: {
          text: `We lost the bank connection for ${user.firstName} ${
            user.lastName
          } | ${user.phone} | ID${user.id}`,
          attachments: [
            {
              title:
                'Do you want to send out the following notification message?',
              text,
              fallback: 'You are unable to approve the request',
              callback_id: `unlinkNotificationApproval_${userID}`,
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

  requestAlgoApproval: {
    schema: [
      [
        'data',
        true,
        [
          ['userID', true, 'integer'],
          ['amount', true, 'integer'],
          ['uri', 'string']
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { userID, amount, uri }
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
        uri: uri || process.env.slackWebhookURL,
        body: {
          text: `Algorithm has choosen $${getDollarString(
            amount
          )} to transfer for ${user.firstName} ${user.lastName} | ${
            user.phone
          } | ID${user.id}`,
          attachments: [
            {
              title: 'Do you approve?',
              fallback: 'You are unable to approve the request',
              callback_id: `algoResultApproval_${userID}_${amount}`,
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
                },
                {
                  name: 'change',
                  text: 'Change amount',
                  type: 'button',
                  value: 'change'
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
      const payload = JSON.parse(ctx.request.body.payload)

      let replyMessage
      if (payload.type === 'interactive_message') {
        const command = payload.callback_id.split('_')[0]

        replyMessage = payload.original_message
        if (command === 'algoResultApproval') {
          replyMessage = await request.post({
            uri: `${config.constants.URL}/admin/approved-algo-result`,
            body: {
              secret: process.env.apiSecret,
              data: { payload }
            },
            json: true
          })
        } else if (command === 'unlinkNotificationApproval') {
          replyMessage = await request.post({
            uri: `${config.constants.URL}/admin/approved-unlink-text`,
            body: {
              secret: process.env.apiSecret,
              data: { payload }
            },
            json: true
          })
        }
      } else if (payload.type === 'dialog_submission') {
        const command = payload.callback_id.split('_')[0]

        if (command === 'changeAmount') {
          const {
            callback_id,
            submission: { amount },
            state: approvalMessageUrl
          } = payload

          const userID = callback_id.split('_')[1]

          await request.post({
            uri: `${config.constants.URL}/slack-request-algo-approval`,
            body: {
              data: {
                userID: parseInt(userID),
                amount: parseInt((amount + 0) * 100),
                uri: approvalMessageUrl
              }
            },
            json: true
          })
          replyMessage = {}
        }
      }

      ctx.body = replyMessage
    }
  }
})