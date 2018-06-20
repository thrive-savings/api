module.exports = (User, twilio, mixpanel, request) => ({
  receiveSms: {
    async method (ctx) {
      const requestBody = ctx.request.body
      const { From: phone, Body: msg } = requestBody
      console.log(requestBody)
      let responseMsg = ''

      // Find user by phone
      let user = await User.findOne({ where: { phone } })
      if (!user) {
        user = await User.findOne({ where: { phone: phone.substr(2) } })
      }

      mixpanel.track('Received Message', { Date: `${new Date()}`, UserID: `${user ? user.id : undefined}`, Message: `${msg}`, Phone: `${phone}` })

      if (!user) {
        console.log(`Did not recognize user: ${phone}`)
        responseMsg = 'Sorry, we don\'t recognize this number.'
      } else {
        console.log(`Found the user with ID: ${user.id}`)
        // Check against available commands
        if (['balance', 'Balance'].includes(msg)) {
          responseMsg = `Your balance: ${user.balance}`
        } else if (['withdraw', 'Withdraw', 'move', 'Move'].includes(msg)) {
          responseMsg = 'Under Development: Withdraw requested'
        } else if (['help', 'Help', 'help!', 'Help!'].includes(msg)) {
          responseMsg = 'Under Development: Help requested'
        } else if (['Hi', 'Hello', 'Hey', 'Yo', 'Hola'].includes(msg)) {
          responseMsg = `Hi ${user.firstName}! How can I help you today?`
        }

        console.log(`Generated the response message: ${responseMsg}`)

        // Check if matched any command
        if (responseMsg) {
          console.log(`Replying to the user with msg: ${responseMsg}`)
          twilio.messages.create({
            from: process.env.twilioNumber,
            to: user.phone,
            body: responseMsg
          })

          mixpanel.track('Sent Message', { Date: `${new Date()}`, Message: `${responseMsg}`, Phone: `${user.phone}` })
        } else {
          // Send to Slack
          const slackMsg = `Incoming message from ${user.phone} | ${user.firstName} ${user.lastName} | Balance ${user.balance} | ${msg}`
          console.log(`Sending to slack: ${slackMsg}`)
          const requestResponse = await request.post({
            uri: process.env.slackWebhookURL,
            body: { text: slackMsg },
            json: true
          })
          console.log(requestResponse)
        }
      }

      ctx.body = {}
    }
  },
  sendSms: {
    async method (ctx) {
      const requestBody = ctx.request.body
      const { text } = requestBody

      let [ phone, msg ] = text.split(' ')

      // Find user by phone
      let user = await User.findOne({ where: { phone } })
      if (!user) {
        user = await User.findOne({ where: { phone: phone.substr(2) } })
      }

      let slackMsg = ''
      if (user) {
        twilio.messages.create({
          from: process.env.twilioNumber,
          to: user.phone,
          body: msg
        })

        slackMsg = `Reply from Thrive to ${user.phone} | ${user.firstName} ${user.lastName} | ${msg}`
        mixpanel.track('Sent Message', { Date: `${new Date()}`, Message: `${msg}`, Phone: `${user.phone}` })
      } else {
        slackMsg = `Error: user with phone ${phone} not found`
      }

      ctx.body = slackMsg
    }
  }
})
