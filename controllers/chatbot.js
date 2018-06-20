module.exports = (Sequelize, User, Queue, twilio, mixpanel, request, config) => ({
  receiveSms: {
    async method (ctx) {
      const getDollarString = amount => {
        let dollars = amount / 100
        dollars = dollars % 1 === 0 ? dollars : dollars.toFixed(2)
        dollars.toLocaleString('en-US', {style: 'currency', currency: 'USD'})
        return dollars
      }

      const requestBody = ctx.request.body
      const { From: phone, Body: msg } = requestBody
      const [ command, ...params ] = msg.split(' ')

      let responseMsg = ''
      let slackMsg
      let setGenericSlackMsg = true

      // Find user by phone
      let user = await User.findOne({ where: { phone } })
      if (!user) {
        user = await User.findOne({ where: { phone: phone.substr(2) } })
      }

      if (!user) {
        slackMsg = `Incoming message from unknown user | Phone: ${phone} | Message: ${msg}`
        responseMsg = 'Sorry, we don\'t recognize this number.'
      } else {
        // Check against available commands
        let mixpanelEvent = ''

        if (['balance', 'Balance'].includes(command)) {
          mixpanelEvent = 'Received Balance Command'
          responseMsg = `Your balance: $${getDollarString(user.balance)}`

          let withdrawsInProgress = 0
          let depositsInProgress = 0
          const queues = await Queue.findAll({ where: { userID: user.id, [Sequelize.Op.or]: [{ processed: false }, { state: 'in_progress' }] } })
          for (const { type, amount } of queues) {
            if (type === 'credit') {
              withdrawsInProgress += amount
            } else {
              depositsInProgress += amount
            }
          }

          if (withdrawsInProgress) {
            responseMsg += `, Withdraws In Transit: $${getDollarString(withdrawsInProgress)}`
          }
          if (depositsInProgress) {
            responseMsg += `, Deposits In Transit: $${getDollarString(depositsInProgress)}`
          }
        } else if (['save', 'Save', 'deposit', 'Deposit'].includes(command)) {
          mixpanelEvent = 'Received Save Command'
          if (!user.bankLinked) {
            responseMsg = 'Link your bank first'
          } else {
            let amount = +params[0]
            if (isNaN(amount)) {
              responseMsg = 'Correct Command Syntax: "Save 10.55"'
            } else {
              amount *= 100
              responseMsg = `Processing your request of $${getDollarString(amount)} deposit`
              twilio.messages.create({
                from: process.env.twilioNumber,
                to: user.phone,
                body: responseMsg
              })
              responseMsg = ''

              slackMsg = `Processing Save Command received from ${user.phone} | ${user.firstName} ${user.lastName} | Balance ${user.balance} | ${msg}`
              setGenericSlackMsg = false

              // Fetch new transactions for user
              const { data: { balance } } = await request.post({
                uri: `${config.constants.URL}/admin/transactions-fetch-user`,
                body: { secret: process.env.apiSecret, data: { userID: user.id } },
                json: true
              })

              // Transfer the amount
              if (amount < balance && amount < 100000) {
                // Create queue entry
                await request.post({
                  uri: `${config.constants.URL}/admin/queue-create`,
                  body: { secret: process.env.apiSecret, data: { userID: user.id, amountInCents: amount, type: 'debit', requestMethod: 'ThriveBot' } },
                  json: true
                })

                // Deposit to VersaPay
                await request.post({
                  uri: `${config.constants.URL}/admin/versapay-sync`,
                  body: { secret: process.env.apiSecret, data: { userID: user.id } },
                  json: true
                })
              } else {
                if (amount >= balance) {
                  responseMsg = `You are requesting to deposit $${getDollarString(amount)}, but your Bank Account Balance is $${getDollarString(balance)}`
                } else {
                  responseMsg = `You are requesting to deposit $${getDollarString(amount)}, which is greater than $1000.00`
                }
              }
            }
          }
        } else if (['withdraw', 'Withdraw', 'move', 'Move'].includes(command)) {
          mixpanelEvent = 'Received Withdraw Command'
          if (!user.bankLinked) {
            responseMsg = 'Link your bank first'
          } else {
            let amount = +params[0]
            if (isNaN(amount)) {
              responseMsg = 'Correct Command Syntax: "Withdraw 10.55"'
            } else {
              amount *= 100
              responseMsg = `Processing your request of $${getDollarString(amount)} withdraw`
              twilio.messages.create({
                from: process.env.twilioNumber,
                to: user.phone,
                body: responseMsg
              })
              responseMsg = ''

              slackMsg = `Processing Withdraw Command received from ${user.phone} | ${user.firstName} ${user.lastName} | Balance ${user.balance} | ${msg}`
              setGenericSlackMsg = false

              let withdrawsInProgress = 0
              const queues = await Queue.findAll({ where: { userID: user.id, type: 'credit', [Sequelize.Op.or]: [{ processed: false }, { state: 'in_progress' }] } })
              for (const { amount } of queues) {
                withdrawsInProgress += amount
              }

              if (amount > user.balance - withdrawsInProgress) {
                if (withdrawsInProgress) {
                  responseMsg = `You are requesting to withdraw $${getDollarString(amount)}, but your Thrive Balance is $${getDollarString(user.balance)} - $${getDollarString(withdrawsInProgress)} [Withdraw Requests In Transit] = $${getDollarString(user.balance - withdrawsInProgress)}`
                } else {
                  responseMsg = `You are requesting to withdraw $${getDollarString(amount)}, but your Thrive Balance is $${getDollarString(user.balance)}`
                }
              } else {
                // Create queue entry
                await request.post({
                  uri: `${config.constants.URL}/admin/queue-create`,
                  body: { secret: process.env.apiSecret, data: { userID: user.id, amountInCents: amount, type: 'credit', requestMethod: 'ThriveBot' } },
                  json: true
                })

                // Deposit to VersaPay
                await request.post({
                  uri: `${config.constants.URL}/admin/versapay-sync`,
                  body: { secret: process.env.apiSecret, data: { userID: user.id } },
                  json: true
                })
              }
            }
          }
        } else if (['help', 'Help', 'help!', 'Help!'].includes(command)) {
          mixpanelEvent = 'Received Help Command'
          responseMsg = 'Under Development: Help requested'
        } else if (['Hi', 'Hello', 'Hey', 'Yo', 'Hola'].includes(command)) {
          mixpanelEvent = 'Received Hi Command'
          responseMsg = `Hi ${user.firstName}! How can I help you today?`
        }

        if (!mixpanelEvent) {
          mixpanelEvent = 'Received Message'
        }
        mixpanel.track(mixpanelEvent, { Date: `${new Date()}`, Message: `${msg}`, Phone: `${user.phone}`, UserID: `${user.id}` })

        // Check if matched any command
        if (responseMsg) {
          twilio.messages.create({
            from: process.env.twilioNumber,
            to: user.phone,
            body: responseMsg
          })
          mixpanel.track('Sent Message', { Date: `${new Date()}`, Message: `${responseMsg}`, Phone: `${user.phone}`, UserID: `${user.id}` })
        } else if (setGenericSlackMsg) {
          // Send to Slack
          slackMsg = `Incoming message from ${user.phone} | ${user.firstName} ${user.lastName} | Balance ${user.balance} | ${msg}`
        }
      }

      if (slackMsg) {
        await request.post({
          uri: process.env.slackWebhookURL,
          body: { text: slackMsg },
          json: true
        })
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
