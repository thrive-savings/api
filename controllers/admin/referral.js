module.exports = (User, Referral, Bluebird, request, config, amplitude) => ({
  reward: {
    schema: [['data', true, [['referralID', true, 'integer']]]],
    async method (ctx) {
      const {
        data: { referralID }
      } = ctx.request.body

      const reply = {}
      try {
        const referral = await Referral.findOne({ where: { id: referralID } })
        if (referral) {
          referral.status = 'rewarded'
          referral.save()

          Bluebird.all([
            request.post({
              uri: `${config.constants.URL}/admin/referral-reward-user`,
              body: {
                secret: process.env.apiSecret,
                data: {
                  userID: referral.sourceID
                }
              },
              json: true
            }),
            request.post({
              uri: `${config.constants.URL}/admin/referral-reward-user`,
              body: {
                secret: process.env.apiSecret,
                data: {
                  userID: referral.targetID
                }
              },
              json: true
            })
          ])
        } else {
          reply.error = true
          reply.errorCode = 'referral_not_found'
          amplitude.track({
            eventType: 'REFERRAL_REWARD_FAIL',
            userId: 'server',
            eventProperties: {
              errorCode: reply.errorCode,
              referralID
            }
          })
        }
      } catch (e) {
        reply.error = true
        reply.errorCode = 'try_catched'
        amplitude.track({
          eventType: 'REFERRAL_REWARD_FAIL',
          userId: 'server',
          eventProperties: {
            error: e,
            errorCode: reply.errorCode,
            referralID
          }
        })
      }

      ctx.body = reply
    }
  },
  rewardUsers: {
    schema: [
      [
        'data',
        true,
        [['sourceID', true, 'integer'], ['targetID', true, 'integer']]
      ]
    ],
    async method (ctx) {
      const {
        data: { sourceID, targetID }
      } = ctx.request.body

      const reply = {}
      try {
        const sourceUser = await User.findOne({ where: { id: sourceID } })
        const targetUser = await User.findOne({ where: { id: targetID } })

        if (sourceUser && targetUser) {
          const referral = await Referral.create({
            sourceID,
            targetID,
            status: 'rewarded'
          })
          request.post({
            uri: `${config.constants.URL}/admin/referral-reward`,
            body: {
              secret: process.env.apiSecret,
              data: {
                referralID: referral.id
              }
            },
            json: true
          })
        } else {
          reply.error = true
          reply.errorCode = 'user_not_found'
          amplitude.track({
            eventType: 'REFERRAL_REWARD_USERS_FAIL',
            userId: 'server',
            eventProperties: {
              errorCode: reply.errorCode,
              sourceID,
              targetID
            }
          })
        }
      } catch (e) {
        reply.error = true
        reply.errorCode = 'try_catched'
        amplitude.track({
          eventType: 'REFERRAL_REWARD_USERS_FAIL',
          userId: 'server',
          eventProperties: {
            error: e,
            errorCode: reply.errorCode,
            sourceID,
            targetID
          }
        })
      }

      ctx.body = reply
    }
  },

  rewardUser: {
    schema: [['data', true, [['userID', true, 'integer']]]],
    async method (ctx) {
      const {
        data: { userID }
      } = ctx.request.body

      const REWARD_AMOUNT = 500

      const reply = {}
      try {
        const user = await User.findOne({ where: { id: userID } })
        if (user) {
          await request.post({
            uri: `${config.constants.URL}/admin/queue-create`,
            body: {
              secret: process.env.apiSecret,
              data: {
                userID,
                amountInCents: REWARD_AMOUNT,
                type: 'reward',
                requestMethod: 'ReferralReward'
              }
            },
            json: true
          })
          await user.updateBalance(REWARD_AMOUNT, 'debit')
          user.sendBonusNotification(REWARD_AMOUNT, 'referral')
          amplitude.track({
            eventType: 'REFERRAL_REWARD_USER_SUCCEED',
            userId: user.id,
            eventProperties: {
              amount: REWARD_AMOUNT
            }
          })
        } else {
          reply.error = true
          reply.errorCode = 'user_not_found'
          amplitude.track({
            eventType: 'REFERRAL_REWARD_USER_FAIL',
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
          eventType: 'REFERRAL_REWARD_USER_FAIL',
          userId: 'server',
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
