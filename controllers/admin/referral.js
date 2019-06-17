module.exports = (User, Referral, Bluebird, request, config, amplitude) => ({
  reward: {
    schema: [['data', true, [['referralID', true, 'integer']]]],
    async method (ctx) {
      const {
        URL,
        TRANSFER: { TYPES, SUBTYPES }
      } = config.constants
      const REWARD_AMOUNT = 500

      const {
        data: { referralID }
      } = ctx.request.body

      const reply = { referralID }
      try {
        const referral = await Referral.findOne({ where: { id: referralID } })
        if (referral) {
          referral.status = 'rewarded'
          referral.save()

          Bluebird.all([
            request.post({
              uri: `${URL}/admin/transfer-create`,
              body: {
                secret: process.env.apiSecret,
                data: {
                  userID: referral.sourceID,
                  amount: REWARD_AMOUNT,
                  type: TYPES.DEBIT,
                  subtype: SUBTYPES.REWARD,
                  extra: {
                    memo: 'Referral program reward',
                    supplyTable: 'Referral',
                    supplyID: referral.id
                  }
                }
              },
              json: true
            }),
            request.post({
              uri: `${URL}/admin/transfer-create`,
              body: {
                secret: process.env.apiSecret,
                data: {
                  userID: referral.targetID,
                  amount: REWARD_AMOUNT,
                  type: TYPES.DEBIT,
                  subtype: SUBTYPES.REWARD,
                  extra: {
                    memo: 'Referral program reward',
                    supplyTable: 'Referral',
                    supplyID: referral.id
                  }
                }
              },
              json: true
            })
          ])
        } else {
          reply.error = true
          reply.errorCode = 'referral_not_found'
        }
      } catch (e) {
        reply.error = true
        reply.errorCode = 'try_catched'
        reply.errorData = e
      }

      if (reply.error) {
        amplitude.track({
          eventType: 'REFERRAL_REWARD_FAIL',
          userId: 'server',
          eventProperties: reply
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
  }
})
