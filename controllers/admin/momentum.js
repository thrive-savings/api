module.exports = (
  Bluebird,
  Sequelize,
  User,
  Account,
  Transfer,
  MomentumOffer,
  amplitude,
  moment,
  request,
  config
) => ({
  // CRON JOBS
  bonus: {
    async method (ctx) {
      const reply = {}

      try {
        const offers = await MomentumOffer.findAll({
          where: {
            status: 'passed_done',
            [Sequelize.Op.or]: [
              { nextBonusDate: null },
              {
                nextBonusDate: {
                  [Sequelize.Op.gt]: moment().startOf('day'),
                  [Sequelize.Op.lt]: moment().endOf('day')
                }
              }
            ]
          }
        })

        if (offers && offers.length) {
          Bluebird.all(
            offers.map(offer =>
              request.post({
                uri: `${config.constants.URL}/admin/momentum-bonus-offer`,
                body: {
                  secret: process.env.apiSecret,
                  data: { offerID: offer.id }
                },
                json: true
              })
            )
          )
          reply.offersCount = offers.length
        } else {
          reply.error = true
          reply.errorCode = 'offers_not_found'
        }
      } catch (e) {
        reply.error = true
        reply.errorCode = 'try_catched'
        reply.errorData = e
      }

      amplitude.track({
        eventType: `MOMENTUM_BONUS_${reply.error ? 'FAIL' : 'PASS'}`,
        userId: 'server',
        eventProperties: reply
      })

      ctx.body = reply
    }
  },

  bonusOffer: {
    schema: [['data', true, [['offerID', true, 'integer']]]],
    async method (ctx) {
      const {
        data: { offerID }
      } = ctx.request.body

      const OFFER_AMOUNT = 1000
      const MAX_BONUS_COUNT = 6

      const {
        URL,
        TRANSFER: { TYPES, SUBTYPES }
      } = config.constants

      const reply = { offerID }
      try {
        const offer = await MomentumOffer.findOne({ where: { id: offerID } })

        if (offer) {
          reply.userID = offer.userID

          const user = await User.findOne({ where: { id: offer.userID } })
          if (user) {
            let savesCount = 0
            if (offer.nextBonusDate) {
              savesCount = await Transfer.countCustom(offer.userID, {
                subtype: SUBTYPES.SAVE,
                fromDate: moment().subtract(1, 'M')
              })
            } else {
              savesCount = await Transfer.countCustom(offer.userID, {
                subtype: SUBTYPES.SAVE
              })
            }

            if (savesCount && offer.bonusCount < MAX_BONUS_COUNT) {
              await request.post({
                uri: `${URL}/admin/transfer-create`,
                body: {
                  secret: process.env.apiSecret,
                  data: {
                    userID: user.id,
                    amount: OFFER_AMOUNT,
                    type: TYPES.DEBIT,
                    subtype: SUBTYPES.REWARD,
                    extra: {
                      memo: 'Momentum offer bonus',
                      supplyTable: 'MomentumOffer',
                      supplyID: offer.id
                    }
                  }
                },
                json: true
              })

              offer.bonusCount = offer.bonusCount + 1
              if (offer.bonusCount >= MAX_BONUS_COUNT) {
                offer.status = 'done'
              }

              amplitude.track({
                eventType: 'MOMENTUM_BONUS_OFFER_SUCCEED',
                userId: user.id,
                eventProperties: {
                  offerID: offer.id,
                  amount: OFFER_AMOUNT
                }
              })
            } else {
              reply.error = true
              reply.errorCode = 'no_saves'
            }

            offer.nextBonusDate = moment().add(1, 'M')
            await offer.save()
          } else {
            reply.error = true
            reply.errorCode = 'user_not_found'
          }
        } else {
          reply.error = true
          reply.errorCode = 'offer_not_found'
        }
      } catch (e) {
        reply.error = true
        reply.errorCode = 'try_catched'
        reply.errorData = e
      }

      if (reply.error) {
        amplitude.track({
          eventType: 'MOMENTUM_BONUS_OFFER_FAIL',
          userId: reply.userID ? reply.userID : 'server',
          eventProperties: reply
        })
      }

      ctx.body = reply
    }
  },

  // END of CRON JOBS

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
              let eligibleAddress = user.userType === 'tester'
              for (const account of accounts) {
                const address = account.getOwnerAddress()
                if (
                  address &&
                  address.city &&
                  address.city.toUpperCase() === 'CALGARY____'
                ) {
                  eligibleAddress = true
                }
              }

              if (eligibleAddress) {
                momentumOffer = await MomentumOffer.create({ userID })
                reply.data = momentumOffer.getData()
                request.post({
                  uri: process.env.slackWebhookURL,
                  body: {
                    text: `Momentum Offer ID ${
                      momentumOffer.id
                    } is created for User ID ${user.id} | ${user.firstName} ${
                      user.lastName
                    }`
                  },
                  json: true
                })
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
