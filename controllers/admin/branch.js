module.exports = (User, request, config, amplitude) => ({
  createLink: {
    schema: [['data', true, [['userID', true, 'integer']]]],
    async method (ctx) {
      const {
        data: { userID }
      } = ctx.request.body

      const reply = {}
      const user = await User.findOne({ where: { id: userID } })

      try {
        if (user) {
          await user.generateReferralCode()

          const res = await request.post({
            uri: `${config.constants.BRANCH_API_URL}/url`,
            body: {
              branch_key: process.env.branchKey,
              feature: 'referral',
              alias: user.referralCode,
              data: {
                $deeplink_path: `${
                  process.env.expoTunnel ? process.env.expoTunnel : 'referral'
                }?referred_user_id=${userID}`,
                userID
              }
            },
            json: true
          })
          console.log(res)
        } else {
          reply.error = true
          reply.errorCode = 'user_not_found'
          amplitude.track({
            eventType: 'BRANCH_CREATE_LINK_FAIL',
            userId: 'server',
            eventProperties: {
              errorCode: reply.errorCode,
              userID
            }
          })
        }
      } catch (e) {
        reply.error = true
        reply.errorCode = 'try_catched'
        amplitude.track({
          eventType: 'BRANCH_CREATE_LINK_FAIL',
          userId: user ? user.id : 'server',
          eventProperties: {
            error: e,
            errorCode: reply.errorCode,
            userID
          }
        })
      }

      ctx.body = reply
    }
  },

  readLink: {
    schema: [['data', true, [['userID', true, 'integer']]]],
    async method (ctx) {
      const {
        data: { userID }
      } = ctx.request.body

      const reply = {}
      const user = await User.findOne({ where: { id: userID } })

      try {
        if (user) {
          const res = await request.get({
            uri: `${
              config.constants.BRANCH_API_URL
            }/url?url=${user.getReferralLink()}&branch_key=${
              process.env.branchKey
            }`,
            json: true
          })
          console.log(res)
        } else {
          reply.error = true
          reply.errorCode = 'user_not_found'
          amplitude.track({
            eventType: 'BRANCH_READ_LINK_FAIL',
            userId: 'server',
            eventProperties: {
              errorCode: reply.errorCode,
              userID
            }
          })
        }
      } catch (e) {
        reply.error = true
        reply.errorCode = 'try_catched'
        amplitude.track({
          eventType: 'BRANCH_READ_LINK_FAIL',
          userId: user ? user.id : 'server',
          eventProperties: {
            error: e,
            errorCode: reply.errorCode,
            userID
          }
        })
      }

      ctx.body = reply
    }
  }
})
