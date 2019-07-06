module.exports = (Bluebird, request, config) => ({
  addDocument: {
    schema: [
      [
        'data',
        true,
        [
          ['legalName', true],
          ['email', true],
          ['phone', true],
          [
            'address',
            true,
            [
              ['street', true],
              ['city', true],
              ['subdivision', true],
              ['zipCode', true],
              ['countryCode', true]
            ]
          ],
          ['dob', true],
          ['ssn', true],
          ['govID', true]
        ]
      ]
    ],
    async method (ctx) {
      const { data } = ctx.request.body

      const { errorCode } = await request.post({
        uri: `${config.constants.URL}/admin/synapse-add-document`,
        body: {
          secret: process.env.apiSecret,
          data: Object.assign({ userID: ctx.authorized.id }, data)
        },
        json: true
      })

      if (errorCode) {
        return Bluebird.reject([
          { key: 'synapse', value: `Error: ${errorCode}` }
        ])
      }

      ctx.body = {}
    }
  }
})
