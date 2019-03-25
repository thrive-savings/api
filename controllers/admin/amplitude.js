module.exports = (
  Bluebird,
  Sequelize,
  User,
  Company,
  amplitude,
  request,
  config
) => ({
  sync: {
    schema: [['data', true, [['userIDs', true, 'array']]]],
    async method (ctx) {
      const {
        data: { userIDs }
      } = ctx.request.body

      let users
      if (userIDs.length > 0) {
        users = await User.findAll({
          where: { id: { [Sequelize.Op.in]: userIDs } }
        })
      } else {
        users = await User.findAll()
      }

      if (users && users.length > 0) {
        Bluebird.all(
          users.map(user =>
            request.post({
              uri: `${
                config.constants.URL
              }/admin/amplitude-sync-user-properties`,
              body: {
                secret: process.env.apiSecret,
                data: {
                  userID: user.id
                }
              },
              json: true
            })
          )
        )
      } else {
        return Bluebird.reject([
          { key: 'no_user_found', value: 'No user found' }
        ])
      }

      ctx.body = {}
    }
  },

  syncUserProperties: {
    schema: [['data', true, [['userID', true, 'integer']]]],
    async method (ctx) {
      const {
        data: { userID }
      } = ctx.request.body

      const user = await User.findOne({
        include: [Company],
        where: { id: userID }
      })

      if (!user) {
        return Bluebird.reject([
          { key: 'user_not_found', value: `User not found for ID${userID}` }
        ])
      }

      let company = {}
      if (user.company) {
        company = user.company
      }

      amplitude.track({
        eventType: 'SYNC_AMPLITUDE_DATA',
        userId: user.id,
        userProperties: {
          Email: user.email,
          Phone: user.phone,
          Balance: user.balance,
          'First Name': user.firstName,
          'Last Name': user.lastName,
          'Employer ID': company.id,
          'Employer Name': company.name,
          'Employer Code': company.code,
          'Work Type': user.workType,
          'Saving Type': user.savingType,
          'Saving Frequency': user.fetchFrequency,
          'Account Verified': user.isVerified,
          'Next Save Date': user.nextSaveDate
        }
      })

      ctx.body = {}
    }
  }
})
