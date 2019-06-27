module.exports = (
  User,
  Transfer,
  twilio,
  amplitude,
  request,
  config,
  emoji,
  ConstantsService,
  HelpersService
) => ({
  process: {
    async method (ctx) {
      const listCommands = () => {
        return "You can use the following list of commands to interact with me:\n\n- 'Balance': get your balance\n- 'Save 20.00': save money\n- 'Withdraw 20.00': withdraw money\n- 'Boost 2x': increase agressiveness level of automatic pulls\n- 'Reduce 2x': reduce agressiveness level of automatic pulls\n\nAnd feel free to reach out us ar help@thrivesavings.com for any custom request."
      }

      const { STATES, SUBTYPES } = ConstantsService.TRANSFER

      const requestBody = ctx.request.body
      const { From: phone, Body: msg } = requestBody
      const [parsedCommand, ...params] = msg.trim().split(' ')
      const command = emoji.unemojify(parsedCommand.toLowerCase())

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
        responseMsg =
          "Hello from Thrive! We don't recognize this number. Please visit https://join.thrivesavings.com to sign up for a Thrive account and start growing your savings."
      } else {
        const NO_CONNECTIONS_MSG = `Hi ${
          user.firstName
        }, it looks like you haven’t connected a bank account yet or we lost the connection to your bank. Please  go to the app to link your primary chequing account.`

        // Check against available commands
        let analyticsEvent = ''

        if (['balance'].includes(command)) {
          analyticsEvent = 'Bot Received Balance Command'
          responseMsg = `Hello ${
            user.firstName
          }. Your balance is ${HelpersService.getDollarString(user.balance)}.`

          const withdrawsInProgress = await Transfer.sumCustom(user.id, {
            subtype: SUBTYPES.WITHDRAW,
            state: STATES.PROCESSING
          })
          const depositsInProgress = await Transfer.sumCustom(user.id, {
            subtype: SUBTYPES.SAVE,
            state: STATES.PROCESSING
          })

          if (withdrawsInProgress && depositsInProgress) {
            responseMsg += ` You also have ${HelpersService.getDollarString(
              depositsInProgress
            )} enroute to Thrive Savings and ${HelpersService.getDollarString(
              withdrawsInProgress
            )} pending withdrawal.`
          } else if (withdrawsInProgress) {
            responseMsg += ` You also have ${HelpersService.getDollarString(
              withdrawsInProgress
            )} pending withdrawal.`
          } else if (depositsInProgress) {
            responseMsg += ` You also have ${HelpersService.getDollarString(
              depositsInProgress
            )} enroute to Thrive Savings.`
          }
        } else if (['save', 'deposit'].includes(command)) {
          analyticsEvent = 'Bot Received Save Command'
          let amount = +params[0]
          if (isNaN(amount) || amount <= 0) {
            responseMsg = 'How much do you want to save? Example: "Save 10.55"'
          } else {
            amount *= 100

            slackMsg = `Processing Save Command from ${user.phone} | ID ${
              user.id
            } | ${user.firstName} ${user.lastName} | Balance ${
              user.balance
            } | ${msg}`
            setGenericSlackMsg = false

            await user.sendMessageAsync(
              `Hi ${
                user.firstName
              }, Your one-time save request has been received, I am currently processing it. Keep up the awesome saving!`
            )

            const { error, errorCode } = await request.post({
              uri: `${config.constants.URL}/admin/saver-try-save`,
              body: {
                secret: process.env.apiSecret,
                data: { userID: user.id, amount, await: true }
              },
              json: true
            })

            if (error) {
              switch (errorCode) {
                case 'no_accounts':
                case 'no_connections':
                  responseMsg = NO_CONNECTIONS_MSG
                  break
                case 'no_default_account':
                case 'no_default_connection':
                  responseMsg = `We cannot process your request as you don't have a primary account set. Please go to your Linked Banks page on the app to set a primary account.`
                  break

                case 'not_enough_balance':
                  responseMsg = `We cannot process your request as your bank account balance may go into insufficient funds.`
                  break
                case 'amount_out_of_range':
                  responseMsg = `Thrive doesn't support deposit of ${HelpersService.getDollarString(
                    amount
                  )}`
                  break

                default:
                  responseMsg =
                    'Oops. Something went wrong. Please contact customer support so we can assist you further.'
                  break
              }
            }
          }
        } else if (['withdraw'].includes(command)) {
          analyticsEvent = 'Bot Received Withdraw Command'
          let amount = +params[0]
          if (isNaN(amount) || amount <= 0) {
            responseMsg =
              'How much do you want to withdraw? Example: "Withdraw 10.55"'
          } else {
            amount *= 100

            slackMsg = `Processing Withdraw Command from ${user.phone} | ID ${
              user.id
            } | ${user.firstName} ${user.lastName} | Balance ${
              user.balance
            } | ${msg}`
            setGenericSlackMsg = false

            await user.sendMessageAsync(
              `Hi ${
                user.firstName
              }, Your withdraw request has been received, I am currently processing it.`
            )

            const { error } = await request.post({
              uri: `${config.constants.URL}/admin/saver-try-withdraw`,
              body: {
                secret: process.env.apiSecret,
                data: { userID: user.id, amount }
              },
              json: true
            })

            if (error) {
              switch (error) {
                case 'no_accounts':
                case 'no_connections':
                  responseMsg = NO_CONNECTIONS_MSG
                  break
                default:
                  responseMsg =
                    'Oops. Something went wrong. Please contact customer support so we can assist you further.'
                  break
              }
            }
          }
        } else if (['boost', ':thumbsup:', ':fire:'].includes(command)) {
          analyticsEvent = 'Bot Received Boost Command'
          let scale =
            command === 'boost'
              ? params[0]
              : command === ':thumbsup:'
                ? '1.5'
                : '2'
          if (!['1.5x', '2x', '1.5', '2'].includes(scale)) {
            responseMsg =
              'Please use one of the exact options. Example: "Boost 2x" (Emojis are not supported at the moment.)'
          } else {
            responseMsg = user.updateAlgoBoost(scale)
          }
        } else if (['reduce', ':thumbsdown:'].includes(command)) {
          analyticsEvent = 'Bot Received Reduce Command'
          let scale = command === 'reduce' ? params[0] : '0.5'
          if (!['0.5x', '0.5'].includes(scale)) {
            responseMsg =
              'Please use one of the exact options. Example: "Reduce 0.5x"'
          } else {
            responseMsg = user.updateAlgoBoost(scale)
          }
        } else if (['invite', 'refer'].includes(command)) {
          analyticsEvent = 'Bot Received Invite Command'
          let invitedPhone = params.join('')
          if (
            !invitedPhone ||
            !invitedPhone.match(
              /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/
            )
          ) {
            responseMsg =
              "Your invitation wasn't sent, please ensure the number is correct. Example: “Invite 416-123-4567”"
          } else {
            invitedPhone = invitedPhone.replace(/\D/g, '')
            const invitedUser = await User.findOne({
              where: { phone: invitedPhone }
            })
            if (invitedUser) {
              slackMsg = `User ${
                user.id
              } *tried to invite* the *already existing* phone # ${invitedPhone}`
              responseMsg = `Your friend with phone number ${invitedPhone} is already using Thrive.`
            } else {
              slackMsg = `User ${
                user.id
              } *successfully invited* the phone # ${invitedPhone}`
              responseMsg = `Your invite to ${invitedPhone} has been successfully sent!`
              twilio.messages.create({
                from: process.env.twilioNumber,
                to: invitedPhone,
                body: `${
                  user.firstName
                }, has invited you to Thrive Savings. Unlock your 3% interest bonus by downloading the app and saving your first $20.\n\nApple download:\nhttps://apple.co/2FVtqM5\n\nGoogle download:\nhttps://bit.ly/2OH5Epy`
              })
            }
          }
        } else if (['help', 'help!', 'commands'].includes(command)) {
          analyticsEvent = 'Bot Received Help Command'
          responseMsg = listCommands()
        } else if (['hi', 'hello', 'hey', 'yo', 'hola'].includes(command)) {
          if (params.length === 0) {
            analyticsEvent = 'Bot Received Hi Command'
            responseMsg = `Hi ${
              user.firstName
            }! How can I help you today?\n\nReply with 'commands' to see list of things I can assist you with.`
          }
        }

        if (!analyticsEvent) {
          analyticsEvent = 'Bot Received Message'
        }
        amplitude.track({
          eventType: analyticsEvent.toUpperCase(),
          userId: user.id,
          eventProperties: {
            Message: msg,
            Phone: user.phone,
            'Message Type': 'Automatic'
          }
        })

        // Check if matched any command
        if (responseMsg) {
          user.sendMessage(responseMsg)
        } else if (setGenericSlackMsg) {
          // Send to Slack
          slackMsg = `Incoming message from User ${user.id} | ${user.phone} | ${
            user.firstName
          } ${user.lastName} | Balance ${user.balance} | ID ${user.id} | ${msg}`
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
  }
})
