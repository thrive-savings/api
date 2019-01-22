module.exports = (
  Sequelize,
  User,
  Account,
  Queue,
  Bluebird,
  request,
  config,
  moment
) => ({
  unlink: {
    schema: [['data', true, [['userIds', true, 'array']]]],
    async method (ctx) {
      const {
        data: { userIds }
      } = ctx.request.body

      const users = await User.findAll({
        where: { id: { [Sequelize.Op.in]: userIds } }
      })

      for (const user of users) {
        user.unlink()
      }

      ctx.body = {}
    }
  },

  updateBalance: {
    schema: [
      [
        'data',
        true,
        [
          ['userID', true, 'integer'],
          ['amount', true, 'integer'],
          ['type', true]
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { userID, amount, type }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: userID } })
      if (!user) {
        return Bluebird.reject([
          { key: 'User', value: `User not found for ID: ${userID}` }
        ])
      }

      // Create queue entry
      await request.post({
        uri: `${config.constants.URL}/admin/queue-create`,
        body: {
          secret: process.env.apiSecret,
          data: {
            userID,
            amountInCents: amount,
            type,
            requestMethod: 'ManualUpdate',
            processed: true
          }
        },
        json: true
      })

      await user.updateBalance(
        amount,
        type === 'debit' ? 'direct_debit' : 'direct_credit'
      )

      ctx.body = {}
    }
  },

  sendSms: {
    schema: [['data', true, [['userID', true, 'integer'], ['message', true]]]],
    async method (ctx) {
      const {
        data: { userID, message }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: userID } })

      let replyMessage = `User with ID [${userID}] not found. Try getting correct ID by using /userID command.`
      if (user) {
        user.sendMessage(message, 'Manual')

        replyMessage = `Reply from Thrive to user ${user.id} | ${
          user.phone
        } | ${user.firstName} ${user.lastName} | ${message}`
      }

      ctx.body = replyMessage
    }
  },

  addCompany: {
    schema: [['data', true, [['names', true, 'array']]]],
    async method (ctx) {
      const {
        data: { names }
      } = ctx.request.body

      let replyMessage = 'Company Added '
      for (const companyName of names) {
        if (companyName) {
          const {
            data: { code: companyCode }
          } = await request.post({
            uri: `${config.constants.URL}/admin/company-add`,
            body: {
              secret: process.env.apiSecret,
              data: { name: companyName.toString().trim() }
            },
            json: true
          })
          replyMessage += `| Name: ${companyName} - Code: ${companyCode} `
        }
      }

      ctx.body = replyMessage
    }
  },

  transfer: {
    schema: [
      [
        'data',
        true,
        [
          ['userID', true, 'integer'],
          ['amount', true, 'integer'],
          ['type', true]
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { userID, amount, type }
      } = ctx.request.body

      let responseMsg = `Processing the transfer for User ${userID}`
      try {
        if (amount >= 5000 && type === 'debit') {
          await request.post({
            uri: `${config.constants.URL}/slack-request-algo-approval`,
            body: {
              data: {
                userID: parseInt(userID),
                amount
              }
            },
            json: true
          })
          responseMsg = ''
        } else {
          await request.post({
            uri: `${config.constants.URL}/admin/worker-transfer`,
            body: {
              secret: process.env.apiSecret,
              data: {
                userID,
                amount,
                type,
                requestMethod: 'Manual'
              }
            },
            json: true
          })
        }
      } catch (e) {
        responseMsg = `Transfer failed for User ${userID}`
      }

      ctx.body = responseMsg
    }
  },

  transferDirect: {
    schema: [
      [
        'data',
        true,
        [
          ['userID', true, 'integer'],
          ['amount', true, 'integer'],
          ['institution', true],
          ['transit', true],
          ['account', true]
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { userID, amount, institution, transit, account }
      } = ctx.request.body

      let responseMsg = `Processing the transfer for User ${userID}`
      try {
        // Create Queue entry
        await Queue.create({
          userID,
          amount,
          type: 'debit',
          requestMethod: 'ManualDirect',
          transactionReference: `THRIVE${userID}_` + moment().format('X')
        })

        // Deposit to VersaPay
        await request.post({
          uri: `${config.constants.URL}/admin/versapay-sync`,
          body: {
            secret: process.env.apiSecret,
            data: { userID, institution, transit, account }
          },
          json: true
        })
      } catch (e) {
        responseMsg = `Direct Transfer failed for User ${userID}`
      }

      ctx.body = responseMsg
    }
  },

  updateUser: {
    schema: [
      [
        'data',
        true,
        [
          ['userID', true, 'integer'],
          ['keyword', true],
          ['submission', true, 'object']
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { userID, keyword, submission }
      } = ctx.request.body

      let responseMsg = ''

      try {
        const user = await User.findOne({ where: { id: userID } })
        if (user) {
          switch (keyword) {
            default:
            case 'bank':
              const { institution, transit, number } = submission
              await Account.update(
                { institution, transit, number },
                { where: { userID, isDefault: true } }
              )
              responseMsg = `Successfully updated bank info for User ${userID}`
              break
            case 'connection':
              const { connectionStatus } = submission
              switch (connectionStatus) {
                default:
                case 'linked':
                  user.bankLinked = true
                  user.relinkRequired = false
                  break
                case 'relinkRequired':
                  user.bankLinked = true
                  user.relinkRequired = true
                  break
                case 'neverLinked':
                  user.bankLinked = false
                  user.relinkRequired = false
                  break
              }
              await user.save()
              responseMsg = `Successfully updated connection status for User ${userID}`
              break
            case 'general':
              const { firstName, lastName, email, phone } = submission
              user.firstName = firstName
              user.lastName = lastName
              user.email = email
              user.phone = phone
              await user.save()
              responseMsg = `Successfully updated general info for User ${userID}`
              break
            case 'preferences':
              const {
                savingType,
                fetchFrequency,
                fixedContribution
              } = submission
              user.savingType = savingType
              user.fetchFrequency = fetchFrequency
              user.fixedContribution = parseInt((fixedContribution + 0) * 100)
              await user.save()
              responseMsg = `Successfully updated saving preferences info for User ${userID}`
              break
            case 'account':
              const { defaultAccountID } = submission
              await Account.update(
                { isDefault: false },
                { where: { userID: user.id, isDefault: true } }
              )
              await Account.update(
                { isDefault: true },
                { where: { userID: user.id, id: defaultAccountID } }
              )
              responseMsg = `Successfully updated default account (Account ID ${defaultAccountID}) info for User ${userID}`
              break
          }
        } else {
          responseMsg = `No user found for ID: ${userID}`
        }
      } catch (e) {
        responseMsg = `Update Failed for User ${userID}`
      }

      ctx.body = responseMsg
    }
  }
})
