module.exports = (Institution, User, Connection, request, config) => ({
  institutions: {
    async method (ctx) {
      try {
        const { institutions } = await request.get({
          uri: `${config.constants.QUOVO_API_URL}/institutions`,
          headers: {
            Authorization: `Bearer ${process.env.quovoApiToken}`
          },
          json: true
        })

        for (const {
          id: quovoInstitutionID,
          name,
          website,
          details,
          access_info: accessInfo,
          is_test: isTest,
          is_available: isAvailable,
          country_code: countryCode
        } of institutions) {
          const obj = {
            quovoInstitutionID,
            name,
            website,
            details,
            accessInfo,
            isTest,
            isAvailable,
            countryCode
          }

          const institutionInstance = await Institution.findOne({
            where: { quovoInstitutionID }
          })

          if (!institutionInstance) {
            await Institution.create(obj)
          } else {
            await institutionInstance.update(obj)
          }
        }
      } catch (e) {
        console.log(e)
      }

      ctx.body = {}
    }
  },

  createUser: {
    schema: [['data', true, [['userID', true, 'integer']]]],
    async method (ctx) {
      const {
        data: { userID }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: userID } })
      const reply = {
        user: {
          id: user.id,
          quovoUserID: user.quovoUserID,
          quovoUserName: user.quovoUserName
        }
      }

      if (!user.quovoUserID) {
        const quovoUserName = `THRIVE_${userID}`

        try {
          const {
            user: { id: quovoUserID }
          } = await request.post({
            uri: `${config.constants.QUOVO_API_URL}/users`,
            headers: {
              Authorization: `Bearer ${process.env.quovoApiToken}`
            },
            body: {
              username: quovoUserName,
              email: user.email,
              name: `${user.firstName} ${user.lastName}`
            },
            json: true
          })

          user.quovoUserID = quovoUserID
          user.quovoUserName = quovoUserName
          await user.save()

          reply.user.quovoUserID = quovoUserID
        } catch (e) {
          reply.error = true
          console.log(e)
        }
      }

      ctx.body = reply
    }
  },

  createConnection: {
    schema: [
      [
        'data',
        true,
        [
          ['userID', true, 'integer'],
          ['quovoUserID', true, 'integer'],
          ['quovoInstitutionID', true, 'integer'],
          ['username', true],
          ['passcode', true]
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { userID, quovoUserID, quovoInstitutionID, username, passcode }
      } = ctx.request.body

      const reply = {}

      try {
        const {
          connection: {
            id: quovoConnectionID,
            institution_name: institutionName,
            value,
            last_good_sync: lastGoodSync,
            last_sync: lastSync,
            status,
            config_instructions: configInstructions
          }
        } = await request.post({
          uri: `${
            config.constants.QUOVO_API_URL
          }/users/${quovoUserID}/connections`,
          headers: {
            Authorization: `Bearer ${process.env.quovoApiToken}`
          },
          body: {
            username,
            passcode,
            institution_id: quovoInstitutionID
          },
          json: true
        })

        const obj = {
          userID,
          quovoConnectionID,
          quovoInstitutionID,
          institutionName,
          value,
          lastGoodSync,
          lastSync,
          status,
          configInstructions
        }
        console.log(obj)

        let connectionInstance = await Connection.findOne({
          where: { quovoConnectionID }
        })

        if (!connectionInstance) {
          connectionInstance = await Connection.create(obj)
        } else {
          await connectionInstance.update(obj)
        }

        // Sync the connection
        const {
          sync: {
            status: syncStatus,
            config_instructions: userConfigInstructions
          },
          challenges
        } = await request.post({
          uri: `${
            config.constants.QUOVO_API_URL
          }/connections/${quovoConnectionID}/sync`,
          headers: {
            Authorization: `Bearer ${process.env.quovoApiToken}`
          },
          body: {
            type: 'auth'
          },
          json: true
        })

        let syncStatusDetails
        if (syncStatus && syncStatus !== 'good') {
          switch (syncStatus) {
            case 'challenges':
              syncStatusDetails = { requireUserAction: true, challenges }
              break
            case 'incorrect_credentials':
              syncStatusDetails = {
                requireUserAction: true,
                message:
                  'The login credentials for the connection are incorrect.'
              }
              break
            case 'user_config':
              syncStatusDetails = {
                requireUserAction: true,
                userConfig: userConfigInstructions
              }
              break
            case 'resync':
              syncStatusDetails = {
                requireUserAction: true,
                message:
                  'The connection needs to be resynced to complete the sync process.'
              }
              break
            case 'postponed':
              syncStatusDetails = {
                requireUserAction: false,
                message:
                  'The institution is inaccessible at the moment. We will attempt another sync at the end of the day.'
              }
              break
            case 'maintenance':
              syncStatusDetails = {
                requireUserAction: false,
                message: 'Our financial data aggregator is under maintenance.'
              }
              break
            case 'no_accounts':
              syncStatusDetails = {
                requireUserAction: false,
                message: 'There were no accounts found within the connection.'
              }
              break
            default:
            case 'institution_unavailable':
              syncStatusDetails = {
                requireUserAction: false,
                message:
                  'We are temporarily unable to sync any connections at this institution.'
              }
              break
          }
        }

        // Update Connection Instance
        await connectionInstance.update({
          status: syncStatus,
          statusDetails: syncStatusDetails
        })

        reply.connection = connectionInstance.getData()
      } catch (e) {
        reply.error = true
        console.log(e)
      }

      ctx.body = reply
    }
  }
})
