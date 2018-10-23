module.exports = (Sequelize, User, request, config) => ({
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

      let responseMsg = 'Processing the transfer.'
      try {
        if (amount >= 5000) {
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
                requestMethod: 'Automated'
              }
            },
            json: true
          })
        }
      } catch (e) {
        responseMsg = 'Something went wrong.'
      }

      ctx.body = responseMsg
    }
  }
})
