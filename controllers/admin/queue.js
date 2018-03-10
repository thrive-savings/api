const uuid = require('uuid/v4')

module.exports = (Queue, Sequelize) => ({
  create: {
    schema: [
      ['data', true, [
        ['userID', true], ['amountInCents', true], ['type', true], ['requestMethod', true]
      ]]
    ],

    async method (ctx) {
      const { data: { userID, amountInCents, type, requestMethod } } = ctx.request.body

      if (userID && amountInCents && type) {
        // TODO: Fetch account ID by user ID
        // TODO: Create transaction reference: userID-userID+timestamp
        const queue = await Queue.create({ userID: userID, amount: amountInCents, type: type, requestMethod: requestMethod})
        ctx.body = { data: { message: 'Request successfully queued' } }
      }
    },
    onError (error) {
      // TODO: fix error validation - 'error' is currently null
      if (error instanceof Sequelize.ForeignKeyConstraintError) {
        const fields = Object.keys(error.fields)
        if (fields.includes('userID')) return [{ key: 'userID', value: 'This userID does not exist in the database' }]
      } else {
        return [{ key: 'message', value: 'An internal error occurred' }]
      }
    }
  }
})
