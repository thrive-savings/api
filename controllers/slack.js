module.exports = (
  Bluebird,
  Sequelize,
  User,
  Connection,
  Account,
  Transfer,
  Company,
  amplitude,
  twilio,
  request,
  config,
  moment
) => ({
  sendSms: {
    async method (ctx) {
      const { token, text } = ctx.request.body

      if (token !== process.env.slackVerificationToken) {
        return Bluebird.reject([
          { key: 'Access Denied', value: `Incorrect Verification Token` }
        ])
      }

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

  sendSmsNew: {
    async method (ctx) {
      const { token, trigger_id, response_url: responseUrl } = ctx.request.body

      if (token !== process.env.slackVerificationToken) {
        return Bluebird.reject([
          { key: 'Access Denied', value: `Incorrect Verification Token` }
        ])
      }

      request.post({
        uri: `${config.constants.URL}/slack-api-call`,
        body: {
          data: {
            url: 'dialog.open',
            body: {
              dialog: JSON.stringify({
                callback_id: `sendSms`,
                title: 'Send SMS',
                submit_label: 'Send',
                elements: [
                  {
                    type: 'text',
                    subtype: 'number',
                    label: 'User ID:',
                    name: 'userID',
                    max_length: 10,
                    min_length: 1
                  },
                  {
                    type: 'textarea',
                    label: 'Message:',
                    name: 'message'
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

  addCompanyNew: {
    async method (ctx) {
      let { token, trigger_id, response_url: responseUrl } = ctx.request.body

      if (token !== process.env.slackVerificationToken) {
        return Bluebird.reject([
          { key: 'Access Denied', value: `Incorrect Verification Token` }
        ])
      }

      request.post({
        uri: `${config.constants.URL}/slack-api-call`,
        body: {
          data: {
            url: 'dialog.open',
            body: {
              dialog: JSON.stringify({
                callback_id: `addCompany`,
                title: 'Add Company',
                submit_label: 'Send',
                elements: [
                  {
                    type: 'text',
                    label: 'Company Name(s):',
                    name: 'names',
                    hint: 'Separate by comma to add multiple companies.'
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

      ctx.body = ''
    }
  },

  listCompanies: {
    async method (ctx) {
      let { token } = ctx.request.body

      if (token !== process.env.slackVerificationToken) {
        return Bluebird.reject([
          { key: 'Access Denied', value: `Incorrect Verification Token` }
        ])
      }

      let slackMsg = '*List of Companies:*\n'
      const companies = await Company.findAll({ order: Sequelize.col('name') })
      for (const { id: companyID, name, code, brandLogoUrl } of companies) {
        slackMsg += ` - *ID:* ${companyID}, *Name:* ${name}, *Code:* ${code}${
          brandLogoUrl ? `, *Logo Name:* ${brandLogoUrl}` : ''
        }\n`
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

  syncAmplitude: {
    async method (ctx) {
      const { token, text } = ctx.request.body

      if (token !== process.env.slackVerificationToken) {
        return Bluebird.reject([
          { key: 'Access Denied', value: `Incorrect Verification Token` }
        ])
      }

      const userID = text.trim()
      let user
      if (userID) {
        user = await User.findOne({ where: { id: userID } })
      }

      let slackMsg = ''
      if (!user) {
        slackMsg = `*Error*: user not found for ID${userID}`
      } else {
        try {
          await request.post({
            uri: `${config.constants.URL}/admin/amplitude-sync-user-properties`,
            body: {
              secret: process.env.apiSecret,
              data: {
                userID: user.id
              }
            },
            json: true
          })
          slackMsg = `Amplitude successfully synced with live data for User ${userID}`
        } catch (e) {
          slackMsg = `*Error*: something went wrong trying to sync Amplitude data for User ${userID}`
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

  createDumbAccount: {
    async method (ctx) {
      const {
        token,
        text,
        trigger_id,
        response_url: responseUrl
      } = ctx.request.body

      if (token !== process.env.slackVerificationToken) {
        return Bluebird.reject([
          { key: 'Access Denied', value: `Incorrect Verification Token` }
        ])
      }

      const [userID, countryCode = 'CAN'] = text.split(' ')

      if (!userID || !countryCode) {
        ctx.body = `Correct Syntax: /create-dumb-account [*userID*] [Optional *countryCode* - [*CAN* or *USA*]`
        return
      }

      let user
      if (userID) {
        user = await User.findOne({ where: { id: userID } })
      }

      let slackMsg = ''
      if (!user) {
        slackMsg = `*Error*: user not found for ID${userID}`
      } else {
        const elements = [
          {
            type: 'text',
            label: 'Account #:',
            name: 'account',
            placeholder: '123456789xxx'
          }
        ]

        if (countryCode && countryCode === 'USA') {
          elements.push({
            type: 'text',
            label: 'Routing #:',
            name: 'routing',
            placeholder: '001'
          })
        } else {
          elements.push(
            {
              type: 'text',
              label: 'Institution #:',
              name: 'institution',
              placeholder: '001'
            },
            {
              type: 'text',
              label: 'Transit #:',
              name: 'transit',
              placeholder: '01234'
            }
          )
        }

        request.post({
          uri: `${config.constants.URL}/slack-api-call`,
          body: {
            data: {
              url: 'dialog.open',
              body: {
                dialog: JSON.stringify({
                  callback_id: `createDumbAccount_${userID}_${countryCode}`,
                  title: 'Create Dumb ACH Account',
                  submit_label: 'Submit',
                  elements,
                  state: responseUrl
                }),
                trigger_id
              }
            }
          },
          json: true
        })
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

  bonusUser: {
    async method (ctx) {
      const {
        token,
        text,
        trigger_id,
        response_url: responseUrl
      } = ctx.request.body

      if (token !== process.env.slackVerificationToken) {
        return Bluebird.reject([
          { key: 'Access Denied', value: `Incorrect Verification Token` }
        ])
      }

      let user
      const [userID] = text.split(' ')
      if (userID) {
        user = await User.findOne({ where: { id: userID } })
        if (!user) {
          ctx.body = `User not found for ID ${userID}`
          return
        }
      }

      request.post({
        uri: `${config.constants.URL}/slack-api-call`,
        body: {
          data: {
            url: 'dialog.open',
            body: {
              dialog: JSON.stringify({
                callback_id: `bonusUser`,
                title: 'Bonus User',
                submit_label: 'Submit',
                elements: [
                  {
                    type: 'text',
                    subtype: 'number',
                    label: 'User ID:',
                    name: 'userID',
                    value: user && user.id,
                    max_length: 10,
                    min_length: 1
                  },
                  {
                    type: 'text',
                    subtype: 'number',
                    label: 'Company ID:',
                    name: 'companyID',
                    value: user && user.companyID,
                    max_length: 10,
                    min_length: 1
                  },
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

      ctx.body = ''
    }
  },

  manageTransfers: {
    async method (ctx) {
      const {
        token,
        text,
        trigger_id,
        response_url: responseUrl
      } = ctx.request.body

      if (token !== process.env.slackVerificationToken) {
        return Bluebird.reject([
          { key: 'Access Denied', value: `Incorrect Verification Token` }
        ])
      }

      const {
        URL,
        TRANSFER: { STATES, SUBTYPES, APPROVAL_STATES, REQUEST_METHODS }
      } = config.constants

      let slackReply
      let dialogBody
      if (text) {
        const [command, ...rest] = text.split(' ')

        switch (command) {
          case 'display':
            if (rest && rest.length && rest[0]) {
              let filter = {}
              const arg0 = rest[0]
              if (arg0 !== 'all') {
                filter = {
                  transferID: arg0
                }
              }

              const reply = await request.post({
                uri: `${URL}/admin/transfer-display`,
                body: {
                  secret: process.env.apiSecret,
                  data: filter
                },
                json: true
              })
              slackReply = reply.message
            }

            if (!slackReply) {
              dialogBody = {
                callback_id: `displayTransfers`,
                title: 'Display Transfer(s) Data',
                submit_label: 'Submit',
                elements: [
                  {
                    type: 'text',
                    label: 'User ID(s):',
                    name: 'userIDs',
                    optional: true,
                    hint:
                      'To filter results by user, provide single or comma separated IDs'
                  },
                  {
                    label: 'Filter by State',
                    type: 'select',
                    subtype: 'text',
                    name: 'state',
                    options: Object.values(STATES).map(val => ({
                      label: val,
                      value: val
                    })),
                    optional: true
                  },
                  {
                    label: 'Filter by Subtype',
                    type: 'select',
                    subtype: 'text',
                    name: 'subtype',
                    options: Object.values(SUBTYPES).map(val => ({
                      label: val,
                      value: val
                    })),
                    optional: true
                  },
                  {
                    label: 'Filter by Request Method',
                    type: 'select',
                    subtype: 'text',
                    name: 'requestMethod',
                    options: Object.values(REQUEST_METHODS).map(val => ({
                      label: val,
                      value: val
                    })),
                    optional: true
                  },
                  {
                    label: 'Filter by Approval State',
                    type: 'select',
                    subtype: 'text',
                    name: 'approvalState',
                    options: Object.values(APPROVAL_STATES).map(val => ({
                      label: val,
                      value: val
                    })),
                    optional: true
                  }
                ],
                state: responseUrl
              }
            }
            break
          case 'create':
            dialogBody = {
              callback_id: `createTransfer`,
              title: 'Create Manual Transfer',
              submit_label: 'Submit',
              elements: [
                {
                  type: 'text',
                  subtype: 'number',
                  label: 'User ID:',
                  name: 'userID',
                  max_length: 10,
                  min_length: 1
                },
                {
                  type: 'text',
                  subtype: 'number',
                  label: 'Account ID:',
                  name: 'accountID',
                  optional: true,
                  hint: 'Default account is chosen if omitted'
                },
                {
                  label: 'Transaction Type:',
                  type: 'select',
                  subtype: 'text',
                  name: 'subtype',
                  options: [SUBTYPES.SAVE, SUBTYPES.WITHDRAW].map(val => ({
                    label: val,
                    value: val
                  }))
                },
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
            }
            break
          default:
            const tab = '   '
            slackReply = `*Transfer Management Syntax Help*:\n - Display:\n${tab} - */transfer display* : then provide filter options through the dialog box\n${tab} - */transfer display [all, transferID]* : shortcuts to display data fro all or single transfer\n - Create:\n${tab} - */transfer create* : to create manual transfer for user`
            break
        }
      }

      if (dialogBody) {
        request.post({
          uri: `${config.constants.URL}/slack-api-call`,
          body: {
            data: {
              url: 'dialog.open',
              body: {
                dialog: JSON.stringify(dialogBody),
                trigger_id
              }
            }
          },
          json: true
        })
      }

      if (slackReply) {
        request.post({
          uri: process.env.slackWebhookURL,
          body: { text: slackReply },
          json: true
        })
      }

      ctx.body = ''
    }
  },

  getUserInfo: {
    async method (ctx) {
      const { token, text } = ctx.request.body

      if (token !== process.env.slackVerificationToken) {
        return Bluebird.reject([
          { key: 'Access Denied', value: `Incorrect Verification Token` }
        ])
      }

      let slackReply = ''
      if (text) {
        const [userID, extra] = text.split(' ')

        const user = await User.findOne({
          include: [{ model: Connection, include: [Account] }],
          where: { id: userID }
        })
        if (user) {
          const {
            firstName,
            lastName,
            email,
            phone,
            balance,
            nextSaveDate,
            fetchFrequency,
            fixedContribution,
            savingType,
            bankLinked,
            quovoUserID
          } = user

          const getDollarString = amount => {
            let dollars = amount / 100
            dollars = dollars % 1 === 0 ? dollars : dollars.toFixed(2)
            dollars.toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD'
            })
            return dollars
          }

          const tab = '   '

          if (extra && extra === 'bank') {
            slackReply += `*Full Bank Information for User ID[${userID}] QuovoID[${quovoUserID}]*\n`
            const connections = user.connections
            if (connections && connections.length > 0) {
              connections.forEach(
                ({
                  id,
                  quovoConnectionID,
                  accounts,
                  institutionName,
                  status,
                  lastSync,
                  lastGoodSync
                }) => {
                  slackReply += ` - *Connection ID[${id}] QuovoID[${quovoConnectionID}]:* \n`
                  slackReply += `${tab} - Institution Name: ${institutionName}\n`
                  slackReply += `${tab} - Status: ${status}\n`
                  slackReply += `${tab} - Last Sync: ${moment(lastSync).format(
                    'dddd, MMMM Do YYYY, h:mm:ss a'
                  )} | Last Good Sync: ${moment(lastGoodSync).format(
                    'dddd, MMMM Do YYYY, h:mm:ss a'
                  )}\n`
                  if (accounts && accounts.length > 0) {
                    accounts.forEach(
                      ({
                        id,
                        quovoAccountID,
                        type,
                        category,
                        nickname,
                        institution,
                        transit,
                        number,
                        isDefault
                      }) => {
                        slackReply += `${tab}- *Account ID[${id}] QuovoID[${quovoAccountID}]: ${
                          isDefault ? 'DEFAULT' : ''
                        }* \n`
                        slackReply += `${tab}${tab} - Name: ${nickname}\n`
                        slackReply += `${tab}${tab} - Type: ${type} | Category: ${category}\n`
                        slackReply += `${tab}${tab} - Payment Info - instituion# ${institution} | transit# ${transit} | account# ${number}\n`
                      }
                    )
                  } else {
                    slackReply += `${tab}- No Accounts Found\n`
                  }
                }
              )
            } else {
              slackReply += ' - No Connections Found\n'
            }
          } else {
            slackReply += `*Information for User ${userID}*${
              user.isActive ? '' : ' *[DEACTIVATED]*'
            }\n - *Full Name:* ${firstName} ${lastName}\n - *Balance:* $${getDollarString(
              balance
            )}\n - *Contact:* ${email} ${phone}\n - *Saving Preferences:* On *${savingType}* plan${
              savingType === 'Thrive Fixed'
                ? ` with *${fixedContribution}* fixed amount`
                : ''
            } every *${fetchFrequency}*\n - *Next Save Date:* ${
              nextSaveDate
                ? moment(nextSaveDate).format('MMM Do, YYYY')
                : 'Not Set'
            } \n - *Bank Status:* ${!bankLinked ? 'Never linked' : 'Linked'}\n`

            const connections = user.connections
            slackReply += `${tab}- *Connections:* `
            if (connections && connections.length > 0) {
              slackReply += `Count - Total: ${connections.length}`
              const activeConnections = connections.filter(
                connection => connection.status === 'good'
              )
              slackReply += `, Active: ${
                activeConnections && activeConnections.length > 0
                  ? activeConnections.length
                  : 0
              }\n`

              const accounts = await Account.findAll({ where: { userID } })
              slackReply += `${tab}- *Accounts:* `
              if (accounts && accounts.length > 0) {
                slackReply += `Count: ${accounts.length} `
                let defaultAccount = accounts.filter(
                  account => account.isDefault
                )
                if (defaultAccount && defaultAccount.length > 0) {
                  defaultAccount = defaultAccount[0]
                  const {
                    id: accountID,
                    transit: accountTransit,
                    nickname: accountNickname,
                    type: accountType
                  } = defaultAccount
                  slackReply += `- *Default Account ID[${accountID}]:* ${accountNickname} - ${accountType} ${
                    accountTransit
                      ? '(Safe to do manual transfer)'
                      : '(Requires to set transit # before manual transfer)'
                  }\n`
                } else {
                  slackReply += 'No Default Account Set\n'
                }
              } else {
                slackReply += `No accounts found\n`
              }
            } else {
              slackReply += `No connections found\n`
            }
          }
        } else {
          slackReply = `No user found for ID ${userID}`
        }
      } else {
        const usersCount = await User.count()
        slackReply = `*${usersCount} users* in the system currently.\nTo get information about specific user please use "/userinfo [userID]"`
      }

      if (slackReply) {
        await request.post({
          uri: process.env.slackWebhookURL,
          body: { text: slackReply },
          json: true
        })
      }

      ctx.body = ''
    }
  },

  updateUserInfo: {
    async method (ctx) {
      const {
        token,
        text,
        trigger_id,
        response_url: responseUrl
      } = ctx.request.body

      if (token !== process.env.slackVerificationToken) {
        return Bluebird.reject([
          { key: 'Access Denied', value: `Incorrect Verification Token` }
        ])
      }

      const KEYWORDS = {
        CONNECTION: 'connection',
        ACCOUNT: 'account',
        ACH: 'ach',
        GENERAL: 'general',
        PREFERENCES: 'preferences'
      }

      let slackReply = ''
      let incorrectSyntax = false

      const [userID, keyword] = text.split(' ')

      let user
      if (userID && keyword) {
        user = await User.findOne({
          include: [{ model: Connection, include: [Account] }],
          where: { id: userID }
        })
      }

      if (user) {
        if (Object.values(KEYWORDS).includes(keyword)) {
          const connections = user.connections
          const connectionOptions = []
          const accountOptions = []
          let primaryConnection
          let primaryAccount
          if (
            [KEYWORDS.CONNECTION, KEYWORDS.ACCOUNT, KEYWORDS.ACH].includes(
              keyword
            )
          ) {
            for (const connection of connections) {
              connectionOptions.push({
                label: `${connection.institutionName} (Status: ${
                  connection.status
                })${connection.isDefault ? ' - PRIMARY' : ''}`,
                value: connection.id
              })
              if (connection.isDefault) {
                primaryConnection = connection
              }

              const accounts = connection.accounts
              if (accounts && accounts.length > 0) {
                for (const account of accounts) {
                  accountOptions.push({
                    label: `${account.nickname}${
                      connection.isDefault && account.isDefault
                        ? ' - MAIN PRIMARY'
                        : account.isDefault
                          ? ' - PRIMARY'
                          : ''
                    }`,
                    value: account.id
                  })
                  if (connection.isDefault && account.isDefault) {
                    primaryAccount = account
                  }
                }
              }
            }
          }

          let elements = []
          switch (keyword) {
            default:
            case KEYWORDS.CONNECTION:
              if (!connections || connections.length === 0) {
                ctx.body = `No connections found for user ${user.id}`
                return
              }

              elements = [
                {
                  label: 'Choose Connection to Sync from Quovo:',
                  type: 'select',
                  subtype: 'text',
                  name: 'connectionID',
                  value: primaryConnection ? primaryConnection.id : '',
                  options: connectionOptions
                }
              ]
              break

            case KEYWORDS.ACCOUNT:
              if (!connections || connections.length === 0) {
                ctx.body = `No connections found for user ${user.id}`
                return
              }

              elements = [
                {
                  label: 'Choose Account to set as Primary:',
                  type: 'select',
                  subtype: 'text',
                  name: 'accountID',
                  value: primaryAccount ? primaryAccount.id : '',
                  options: accountOptions
                }
              ]
              break

            case KEYWORDS.ACH:
              if (!connections || connections.length === 0) {
                ctx.body = `No connections found for user ${user.id}`
                return
              }

              const { institution = '', transit = '', number = '' } =
                primaryAccount || {}

              elements = [
                {
                  label: 'Account to set ACH numbers:',
                  type: 'select',
                  subtype: 'text',
                  name: 'accountID',
                  value: primaryAccount ? primaryAccount.id : '',
                  options: accountOptions
                },
                {
                  type: 'text',
                  label: 'Institution #:',
                  name: 'institution',
                  value: institution,
                  placeholder: '001'
                },
                {
                  type: 'text',
                  label: 'Transit #:',
                  name: 'transit',
                  value: transit,
                  placeholder: '01234'
                },
                {
                  type: 'text',
                  label: 'Account #:',
                  name: 'number',
                  value: number,
                  placeholder: '123456789xxx'
                }
              ]
              break

            case KEYWORDS.GENERAL:
              elements = [
                {
                  label: 'First Name',
                  type: 'text',
                  name: 'firstName',
                  value: user.firstName
                },
                {
                  label: 'Last Name',
                  type: 'text',
                  name: 'lastName',
                  value: user.lastName
                },
                {
                  label: 'Email',
                  type: 'text',
                  name: 'email',
                  value: user.email
                },
                {
                  label: 'Phone',
                  type: 'text',
                  name: 'phone',
                  value: user.phone
                },
                {
                  label: 'Is Active?',
                  type: 'select',
                  subtype: 'text',
                  name: 'isActive',
                  value: user.isActive ? 1 : 0,
                  options: [
                    { label: 'True', value: 1 },
                    { label: 'False', value: 0 }
                  ]
                }
              ]
              break

            case KEYWORDS.PREFERENCES:
              const getDollarString = amount => {
                let dollars = amount / 100
                dollars = dollars % 1 === 0 ? dollars : dollars.toFixed(2)
                dollars.toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD'
                })
                return dollars
              }
              elements = [
                {
                  label: 'Days to Next Save',
                  name: 'daysToNextSave',
                  type: 'text',
                  value: user.daysToNextSave(),
                  hint:
                    "Setting x > 0 will set the Next Save Date to x days from today. Don't set negative number as it will set it to the past."
                },
                {
                  label: 'Saving Type',
                  type: 'select',
                  subtype: 'text',
                  name: 'savingType',
                  value: user.savingType,
                  options: [
                    { label: 'Thrive Fixed', value: 'Thrive Fixed' },
                    { label: 'Thrive Flex', value: 'Thrive Flex' }
                  ]
                },
                {
                  label: 'Fetch Frequency',
                  type: 'select',
                  subtype: 'text',
                  name: 'fetchFrequency',
                  value: user.fetchFrequency,
                  options: [
                    { label: 'Once Weekly', value: 'ONCEWEEKLY' },
                    { label: 'Bi-weekly', value: 'BIWEEKLY' },
                    { label: 'Once Monthly', value: 'ONCEMONTHLY' },
                    { label: 'Once Daily', value: 'ONCEDAILY' }
                  ]
                },
                {
                  label: 'Fixed Contribution',
                  type: 'text',
                  name: 'fixedContribution',
                  value: getDollarString(user.fixedContribution),
                  hint: 'Example amount format: 10.25',
                  max_length: 6,
                  min_length: 1
                }
              ]
              break
          }

          request.post({
            uri: `${config.constants.URL}/slack-api-call`,
            body: {
              data: {
                url: 'dialog.open',
                body: {
                  dialog: JSON.stringify({
                    callback_id: `updateUser_${userID}_${keyword}`,
                    title: 'Update User',
                    submit_label: 'Update',
                    elements,
                    state: responseUrl
                  }),
                  trigger_id
                }
              }
            },
            json: true
          })
        } else {
          incorrectSyntax = true
        }
      } else {
        incorrectSyntax = true
      }

      if (incorrectSyntax) {
        slackReply = `Correct Syntax: /updateuser [*userID*] [one of keywords [*${Object.values(
          KEYWORDS
        ).join()}*]`
      }

      ctx.body = slackReply
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

  requestTransferApproval: {
    schema: [['data', true, [['transferID', true, 'integer'], ['uri']]]],
    async method (ctx) {
      const {
        data: { transferID, uri }
      } = ctx.request.body

      const transfer = await Transfer.findOne({
        include: [User],
        where: { id: transferID }
      })
      if (!transfer) {
        return Bluebird.reject(`Transfer not found for ID ${transferID}`)
      }

      const getDollarString = amount => {
        let dollars = amount / 100
        dollars = dollars % 1 === 0 ? dollars : dollars.toFixed(2)
        dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
        return `$${dollars}`
      }

      await request.post({
        uri: uri || process.env.slackWebhookURL,
        body: {
          text: `Transfer ID ${
            transfer.id
          } requires *Admin Approval* | Amount: ${getDollarString(
            transfer.amount
          )} | Type: ${transfer.type} | Subtype: ${transfer.subtype} | UserID ${
            transfer.userID
          }`,
          attachments: [
            {
              title: 'Do you approve?',
              fallback: 'You are unable to approve the request',
              callback_id: `transferApproval_${transferID}`,
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

  interaction: {
    async method (ctx) {
      const payload = JSON.parse(ctx.request.body.payload)

      let replyMessage
      if (payload.type === 'interactive_message') {
        const command = payload.callback_id.split('_')[0]

        replyMessage = payload.original_message
        if (command === 'transferApproval') {
          replyMessage = await request.post({
            uri: `${config.constants.URL}/admin/approved-transfer-amount`,
            body: {
              secret: process.env.apiSecret,
              data: { payload }
            },
            json: true
          })
        } else if (command === 'algoResultApproval') {
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

        if (command === 'changeTransferAmount') {
          const {
            callback_id,
            submission: { amount },
            state: origianlMesageURI
          } = payload

          const transferID = callback_id.split('_')[1]

          await request.post({
            uri: `${config.constants.URL}/admin/transfer-update-amount`,
            body: {
              secret: process.env.apiSecret,
              data: {
                transferID: +transferID,
                amount: Math.round(+amount * 100),
                origianlMesageURI
              }
            },
            json: true
          })

          replyMessage = {}
        } else if (command === 'sendSms') {
          const {
            submission: { userID, message }
          } = payload

          replyMessage = await request.post({
            uri: `${config.constants.URL}/admin/manual-send-sms`,
            body: {
              secret: process.env.apiSecret,
              data: {
                userID: parseInt(userID),
                message
              }
            },
            json: true
          })

          if (replyMessage) {
            await request.post({
              uri: process.env.slackWebhookURL,
              body: { text: replyMessage },
              json: true
            })
            replyMessage = {}
          }
        } else if (command === 'addCompany') {
          const {
            submission: { names }
          } = payload

          replyMessage = await request.post({
            uri: `${config.constants.URL}/admin/manual-add-company`,
            body: {
              secret: process.env.apiSecret,
              data: { names: names.split(',') }
            },
            json: true
          })

          if (replyMessage) {
            await request.post({
              uri: process.env.slackWebhookURL,
              body: { text: replyMessage },
              json: true
            })
            replyMessage = {}
          }
        } else if (command === 'createDumbAccount') {
          const userID = payload.callback_id.split('_')[1]
          const countryCode = payload.callback_id.split('_')[2]

          const { submission: achNumbers } = payload
          if (achNumbers) {
            replyMessage = await request.post({
              uri: `${config.constants.URL}/admin/manual-create-dumb-account`,
              body: {
                secret: process.env.apiSecret,
                data: {
                  userID: +userID,
                  countryCode,
                  achNumbers
                }
              },
              json: true
            })
          }

          if (replyMessage) {
            await request.post({
              uri: process.env.slackWebhookURL,
              body: { text: replyMessage },
              json: true
            })
            replyMessage = {}
          }
        } else if (command === 'displayTransfers') {
          const { submission: filter } = payload

          const reply = await request.post({
            uri: `${config.constants.URL}/admin/transfer-display`,
            body: {
              secret: process.env.apiSecret,
              data: { filter }
            },
            json: true
          })
          replyMessage = reply.message

          if (replyMessage) {
            await request.post({
              uri: process.env.slackWebhookURL,
              body: { text: replyMessage },
              json: true
            })
            replyMessage = {}
          }
        } else if (command === 'createTransfer') {
          const {
            submission: { userID, accountID, subtype, amount }
          } = payload

          const requestData = {
            userID: +userID,
            subtype,
            amount: Math.round(+amount * 100)
          }
          if (accountID) {
            requestData.accountID = +accountID
          }
          const reply = await request.post({
            uri: `${config.constants.URL}/admin/transfer-create-manual`,
            body: {
              secret: process.env.apiSecret,
              data: requestData
            },
            json: true
          })
          replyMessage = reply.message

          if (replyMessage) {
            await request.post({
              uri: process.env.slackWebhookURL,
              body: { text: replyMessage },
              json: true
            })
            replyMessage = {}
          }
        } else if (command === 'bonusUser') {
          const {
            submission: { userID, companyID, amount }
          } = payload

          replyMessage = await request.post({
            uri: `${config.constants.URL}/admin/manual-bonus-user`,
            body: {
              secret: process.env.apiSecret,
              data: {
                userID: +userID,
                companyID: +companyID,
                amount: Math.round(+amount * 100)
              }
            },
            json: true
          })

          if (replyMessage) {
            await request.post({
              uri: process.env.slackWebhookURL,
              body: { text: replyMessage },
              json: true
            })
            replyMessage = {}
          }
        } else if (command === 'updateUser') {
          const { callback_id, submission } = payload
          const [, userID, keyword] = callback_id.split('_')

          replyMessage = await request.post({
            uri: `${config.constants.URL}/admin/manual-update-user`,
            body: {
              secret: process.env.apiSecret,
              data: {
                userID: parseInt(userID),
                keyword,
                submission
              }
            },
            json: true
          })

          if (replyMessage) {
            await request.post({
              uri: process.env.slackWebhookURL,
              body: { text: replyMessage },
              json: true
            })
            replyMessage = {}
          }
        }
      }

      ctx.body = replyMessage
    }
  }
})
