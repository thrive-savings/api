module.exports = (Sequelize, User, Queue, twilio, amplitude, request, config) => ({
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
        responseMsg = 'Hello from Thrive! We don\'t recognize this number. Please visit https://join.thrivesavings.com to sign up for a Thrive account and start growing your savings.'
      } else {
        // Check against available commands
        let analyticsEvent = ''

        if (['balance', 'Balance'].includes(command)) {
          analyticsEvent = 'Bot Received Balance Command'
          responseMsg = `Hello ${user.firstName}. Your balance is $${getDollarString(user.balance)}.`

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

          if (withdrawsInProgress && depositsInProgress) {
            responseMsg += ` You also have $${getDollarString(depositsInProgress)} enroute to Thrive Savings and $${getDollarString(withdrawsInProgress)} pending withdrawal.`
          }
          else if (withdrawsInProgress) {
            responseMsg += ` You also have $${getDollarString(withdrawsInProgress)} pending withdrawal.`
          }
          else if (depositsInProgress) {
            responseMsg += ` You also have $${getDollarString(depositsInProgress)} enroute to Thrive Savings.`
          }
        } else if (['save', 'Save', 'deposit', 'Deposit'].includes(command)) {
          analyticsEvent = 'Bot Received Save Command'
          if (!user.bankLinked) {
            responseMsg = `Hi ${user.name}, it looks like you haven’t connected a bank account yet. Please  go to the app to link your primary chequing account.`
          } else {
            let amount = +params[0]
            if (isNaN(amount) || amount <= 0) {
              responseMsg = 'How much do you want to save? Example: "Save 10.55"'
            } else {
              amount *= 100

              slackMsg = `Processing Save Command from ${user.phone} | ${user.firstName} ${user.lastName} | Balance ${user.balance} | ${msg}`
              setGenericSlackMsg = false

              // Fetch new transactions for user
              const { data: { balance } } = await request.post({
                uri: `${config.constants.URL}/admin/transactions-fetch-user`,
                body: { secret: process.env.apiSecret, data: { userID: user.id } },
                json: true
              })

              // Transfer the amount
              if (amount < balance && amount <= 100000 && amount >= 500) {
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
                  responseMsg = `We cannot process your deposit request as your bank account balance may go into insufficient funds. `
                } else if (amount > 100000) {
                  responseMsg = `You are requesting to deposit $${getDollarString(amount)}. We don't support depositing over $1000 at the moment.`
                } else if (amount < 500) {
                  responseMsg = `The minimum amount to deposit is $5.00. Please enter an amount above $5.00.`
                }
              }
            }
          }
        } else if (['withdraw', 'Withdraw', 'move', 'Move'].includes(command)) {
          analyticsEvent = 'Bot Received Withdraw Command'
          if (!user.bankLinked) {
            responseMsg = `Hi ${user.name}, it looks like you haven’t connected a bank account yet. Please  go to the app to link your primary chequing account.`
          } else {
            let amount = +params[0]
            if (isNaN(amount) || amount <= 0) {
              responseMsg = 'How much do you want to withdraw? Example: "Withdraw 10.55"'
            } else {
              amount *= 100

              slackMsg = `Processing Withdraw Command from ${user.phone} | ${user.firstName} ${user.lastName} | Balance ${user.balance} | ${msg}`
              setGenericSlackMsg = false

              let withdrawsInProgress = 0
              const queues = await Queue.findAll({ where: { userID: user.id, type: 'credit', [Sequelize.Op.or]: [{ processed: false }, { state: 'in_progress' }] } })
              for (const { amount } of queues) {
                withdrawsInProgress += amount
              }

              if (amount > user.balance - withdrawsInProgress) {
                if (withdrawsInProgress) {
                  responseMsg = `We cannot process your withdraw request due to previous withdraw request(s) of $${getDollarString(withdrawsInProgress)} which will bring your balance to $${getDollarString(user.balance - withdrawsInProgress)}.`
                } else {
                  responseMsg = `The amount of $${getDollarString(amount)} you requested to withdraw exceeds your balance of $${getDollarString(user.balance)}.`
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
        } else if (['invite', 'Invite'].includes(command)) {
          analyticsEvent = 'Bot Received Invite Command'
          let invitedPhone = params[0]
          if (invitedPhone && !invitedPhone.match(/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/)) {
            responseMsg = 'Do you want to invite a friend? Example: "Invite 647-123-4567"'
          } else {
            responseMsg = `Invitation has been sent to ${invitedPhone}.`
            twilio.messages.create({
              from: process.env.twilioNumber,
              to: invitedPhone,
              body: `Your friend, ${user.firstName}, has invited you to use Thrive Savings app to improve your financial well-being. You can download the mobile from Apple App Store or Google Play Store by searching for Thrive Savings.`
            })
          }
        } else if (['help', 'Help', 'help!', 'Help!'].includes(command)) {
          analyticsEvent = 'Bot Received Help Command'
          responseMsg = `Please email help@thrivesavings.com to contact support.`
        } else if (['Hi', 'Hello', 'Hey', 'Yo', 'Hola'].includes(command)) {
          analyticsEvent = 'Bot Received Hi Command'
          responseMsg = `Hi ${user.firstName}! How can I help you today?`
        }

        if (!analyticsEvent) {
          analyticsEvent = 'Bot Received Message'
        }
        amplitude.track({
          eventType: analyticsEvent.toUpperCase(),
          userId: user.id,
          eventProperties: {
            'Message': msg,
            'Phone': user.phone,
            'Message Type': 'Automatic'
          }
        })

        // Check if matched any command
        if (responseMsg) {
          twilio.messages.create({
            from: process.env.twilioNumber,
            to: user.phone,
            body: responseMsg
          })
          amplitude.track({
            eventType: 'BOT SENT MESSAGE',
            userId: user.id,
            eventProperties: {
              'Message': responseMsg,
              'Phone': user.phone,
              'Message Type': 'Automatic'
            }
          })
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

      let [ phone, ...msg ] = text.split(' ')

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

        slackMsg = `Reply from Thrive to ${user.phone} | ${user.firstName} ${user.lastName} | ${msg}`
        amplitude.track({
          eventType: 'BOT SENT MESSAGE',
          userId: user.id,
          eventProperties: {
            'Message': msg,
            'Phone': user.phone,
            'Message Type': 'Manual'
          }
        })
      } else {
        slackMsg = `Error: user with phone ${phone} not found`
      }

      ctx.body = slackMsg
    }
  },
  addCompany: {
    async method (ctx) {
      let { text: companyNames } = ctx.request.body
      companyNames = companyNames.split(',')

      let slackMsg = 'Company Added '
      for (const companyName of companyNames) {
        if (companyName) {
          const { data: { code: companyCode } } = await request.post({
            uri: `${config.constants.URL}/admin/company-add`,
            body: { secret: process.env.apiSecret, data: { name: companyName.toString() } },
            json: true
          })
          slackMsg += `| Name: ${companyName} - Code: ${companyCode} `
        }
      }

      ctx.body = slackMsg
    }
  }
})
