module.exports = (User, SynapseEntry, SynapseNode, request, config) => {
  const headers = {
    'X-SP-GATEWAY': `${process.env.synapseClientID}|${
      process.env.synapseClientSecret
    }`,
    'X-SP-USER-IP': '127.0.0.1',
    'X-SP-USER': `|${process.env.synapseUserID}`
  }

  const FAKE_ADDRESS = {
    address_street: '1 Market St.',
    address_city: 'San Francisco',
    address_subdivision: 'CA',
    address_postal_code: '94114',
    address_country_code: 'US'
  }

  return {
    createUser: {
      schema: [['data', true, [['userID', true, 'integer']]]],
      async method (ctx) {
        const {
          data: { userID }
        } = ctx.request.body

        const reply = {}
        try {
          const user = await User.findOne({ where: { id: userID } })
          if (user) {
            const { id: userID, email, phone, firstName, lastName } = user

            let synapseEntry = await SynapseEntry.findOne({
              where: { userID }
            })
            if (!synapseEntry) {
              const suppID = `THRIVE${
                process.env.NODE_ENV !== 'production' ? '_DEV' : ''
              }_${userID}`

              const res = await request.post({
                uri: `${config.constants.SYNAPSE_API_URL}/users`,
                headers,
                body: {
                  logins: [{ email }],
                  emails: [email],
                  phone_numbers: [phone],
                  legal_names: [`${firstName} ${lastName}`],
                  extra: {
                    supp_id: suppID
                  }
                },
                json: true
              })

              const {
                _id: synapseUserID,
                doc_status: docStatus,
                documents,
                emails,
                legal_names: legalNames,
                logins,
                phone_numbers: phoneNumbers,
                photos,
                extra,
                is_hidden: isHidden,
                permission
              } = res

              console.log('--------------SynapseEntryData-------------')
              console.log(res)
              console.log('-------------------------------------------')

              synapseEntry = await SynapseEntry.create({
                synapseUserID,
                docStatus,
                documents,
                documentsToSubmit: {
                  legalName: `${firstName} ${lastName}`,
                  email,
                  phone,
                  adress: {
                    // TODO: should get from user model
                    street: FAKE_ADDRESS.address_street,
                    city: FAKE_ADDRESS.address_city,
                    subdivision: FAKE_ADDRESS.address_subdivision,
                    zipCode: FAKE_ADDRESS.address_postal_code,
                    countryCode: FAKE_ADDRESS.address_country_code
                  },
                  // TODO: remove next two when done
                  virtualDoc: {},
                  physicalDoc: {}
                },
                emails,
                legalNames,
                logins,
                phoneNumbers,
                photos,
                extra,
                isHidden,
                permission,
                userID
              })
              reply.data = synapseEntry.getData()
            } else {
              reply.error = true
              reply.errorCode = 'synapse_entry_already_exists'
            }
          } else {
            reply.error = true
            reply.errorCode = 'user_not_found'
          }
        } catch (e) {
          reply.error = true
          reply.errorCode = 'try_catched'
          reply.errorData = e
        }

        ctx.body = reply
      }
    },

    deleteUser: {
      schema: [['data', true, [['userID', true, 'integer']]]],
      async method (ctx) {
        const {
          data: { userID }
        } = ctx.request.body

        const reply = { userID }
        try {
          const res = await request.delete({
            uri: `${
              config.constants.SYNAPSE_API_URL
            }/users/5d0d2194623ff96beb7593c0`,
            headers,
            json: true
          })
          console.log(res)
        } catch (e) {
          reply.error = true
          reply.errorCode = 'try_catched'
          reply.errorData = e
        }

        ctx.body = reply
      }
    }
  }
}
