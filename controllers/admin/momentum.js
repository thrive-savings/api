module.exports = (User, Account, MomentumOffer, amplitude) => ({
  createOffer: {
    schema: [['data', true, [['userID', true, 'integer']]]],
    async method (ctx) {
      const {
        data: { userID }
      } = ctx.request.body

      const reply = {}
      try {
        const user = await User.findOne({ where: { id: userID } })
        if (user) {
          let momentumOffer = await MomentumOffer.findOne({
            where: { userID }
          })

          if (!momentumOffer) {
            const accounts = await Account.findAll({ where: { userID } })
            if (accounts.length) {
              let eligibleAddress = false
              for (const account of accounts) {
                const address = account.getOwnerAddress()
                console.log(address)
                if (
                  address &&
                  address.city &&
                  address.city.toUpperCase() === 'COURTENAY'
                ) {
                  eligibleAddress = true
                }
              }

              if (eligibleAddress) {
                momentumOffer = await MomentumOffer.create({ userID })
                reply.data = momentumOffer.getData()
              } else {
                reply.error = true
                reply.errorCode = 'no_eligible_address'
                amplitude.track({
                  eventType: 'MOMENTUM_CREATE_OFFER_FAIL',
                  userId: userID,
                  eventProperties: reply
                })
              }
            } else {
              reply.error = true
              reply.errorCode = 'no_accounts_found'
              amplitude.track({
                eventType: 'MOMENTUM_CREATE_OFFER_FAIL',
                userId: userID,
                eventProperties: reply
              })
            }
          } else {
            reply.data = momentumOffer.getData()
            reply.error = true
            reply.errorCode = 'momentum_offer_already_exists'
            amplitude.track({
              eventType: 'MOMENTUM_CREATE_OFFER_FAIL',
              userId: userID,
              eventProperties: reply
            })
          }
        } else {
          reply.error = true
          reply.errorCode = 'no_user_found'
          amplitude.track({
            eventType: 'MOMENTUM_CREATE_OFFER_FAIL',
            userId: userID,
            eventProperties: reply
          })
        }
      } catch (e) {
        reply.error = true
        reply.errorCode = 'try_catched'
        amplitude.track({
          eventType: 'MOMENTUM_CREATE_OFFER_FAIL',
          userId: userID,
          eventProperties: {
            error: e,
            errorCode: reply.errorCode
          }
        })
      }

      ctx.body = reply
    }
  },

  updateOfferStatus: {
    schema: [['data', true, [['userID', true, 'integer'], ['status', true]]]],
    async method (ctx) {
      const {
        data: { userID, status }
      } = ctx.request.body

      const reply = {}
      try {
        const user = await User.findOne({ where: { id: userID } })
        if (user) {
          const momentumOffer = await MomentumOffer.findOne({
            where: { userID }
          })

          if (momentumOffer) {
            if (
              [
                'waiting',
                'uninterested',
                'ineligible',
                'passed',
                'passed_done',
                'ineligible_done'
              ].includes(status)
            ) {
              await momentumOffer.update({ status })
              reply.data = momentumOffer.getData()
            } else {
              reply.error = true
              reply.errorCode = 'invalid_offer_status'
              amplitude.track({
                eventType: 'MOMENTUM_UPDATE_OFFER_STATUS_FAIL',
                userId: userID,
                eventProperties: reply
              })
            }
          } else {
            reply.error = true
            reply.errorCode = 'momentum_offer_not_found'
            amplitude.track({
              eventType: 'MOMENTUM_UPDATE_OFFER_STATUS_FAIL',
              userId: userID,
              eventProperties: reply
            })
          }
        } else {
          reply.error = true
          reply.errorCode = 'no_user_found'
          amplitude.track({
            eventType: 'MOMENTUM_UPDATE_OFFER_STATUS_FAIL',
            userId: userID,
            eventProperties: reply
          })
        }
      } catch (e) {
        reply.error = true
        reply.errorCode = 'try_catched'
        amplitude.track({
          eventType: 'MOMENTUM_UPDATE_OFFER_STATUS_FAIL',
          userId: userID,
          eventProperties: {
            error: e,
            errorCode: reply.errorCode
          }
        })
      }

      ctx.body = reply
    }
  },

  checkEligibility: {
    schema: [
      [
        'data',
        true,
        [
          ['userID', true, 'integer'],
          ['householdCount', true, 'integer'],
          ['isIncomeBelow', true, 'boolean']
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { userID, householdCount, isIncomeBelow }
      } = ctx.request.body

      const reply = {}
      try {
        const user = await User.findOne({ where: { id: userID } })
        if (user) {
          const momentumOffer = await MomentumOffer.findOne({
            where: { userID }
          })

          if (momentumOffer) {
            await momentumOffer.update({
              householdCount,
              isIncomeBelow,
              status: isIncomeBelow ? 'passed' : 'ineligible'
            })
            reply.data = momentumOffer.getData()
          } else {
            reply.error = true
            reply.errorCode = 'momentum_offer_not_found'
            amplitude.track({
              eventType: 'MOMENTUM_CHECK_ELIGIBILITY_FAIL',
              userId: userID,
              eventProperties: reply
            })
          }
        } else {
          reply.error = true
          reply.errorCode = 'no_user_found'
          amplitude.track({
            eventType: 'MOMENTUM_CHECK_ELIGIBILITY_FAIL',
            userId: userID,
            eventProperties: reply
          })
        }
      } catch (e) {
        reply.error = true
        reply.errorCode = 'try_catched'
        amplitude.track({
          eventType: 'MOMENTUM_CHECK_ELIGIBILITY_FAIL',
          userId: userID,
          eventProperties: {
            error: e,
            errorCode: reply.errorCode
          }
        })
      }

      ctx.body = reply
    }
  }
})
