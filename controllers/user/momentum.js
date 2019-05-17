module.exports = (User, request, config, Bluebird) => ({
  updateOfferStatus: {
    schema: [['data', true, [['status', true]]]],
    async method (ctx) {
      const {
        data: { status }
      } = ctx.request.body

      const reply = {}
      const user = await User.findOne({ where: { id: ctx.authorized.id } })

      const res = await request.post({
        uri: `${config.constants.URL}/admin/momentum-update-offer-status`,
        body: {
          secret: process.env.apiSecret,
          data: {
            userID: user.id,
            status
          }
        },
        json: true
      })

      console.log(res)

      if (res.error) {
        return Bluebird.reject([
          {
            key: res.errorCode,
            value: 'Something went wrong updating momentum offer status'
          }
        ])
      }

      reply.momentumOfferData = res.data
      ctx.body = reply
    }
  },
  checkEligibility: {
    schema: [
      [
        'data',
        true,
        [
          ['householdCount', true, 'integer'],
          ['isIncomeBelow', true, 'boolean']
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { householdCount, isIncomeBelow }
      } = ctx.request.body

      const reply = {}
      const user = await User.findOne({ where: { id: ctx.authorized.id } })

      const res = await request.post({
        uri: `${config.constants.URL}/admin/momentum-check-eligibility`,
        body: {
          secret: process.env.apiSecret,
          data: {
            userID: user.id,
            householdCount,
            isIncomeBelow
          }
        },
        json: true
      })

      if (res.error) {
        return Bluebird.reject([
          {
            key: res.errorCode,
            value: "Something went wrong checking user's eligibility"
          }
        ])
      }

      reply.momentumOfferData = res.data
      ctx.body = reply
    }
  }
})
