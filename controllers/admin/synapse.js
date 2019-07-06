module.exports = (User, SynapseEntry, SynapseNode, moment, request, config) => {
  const getHeaders = (authKey = '') => ({
    'X-SP-GATEWAY': `${process.env.synapseClientID}|${
      process.env.synapseClientSecret
    }`,
    'X-SP-USER-IP': '127.0.0.1',
    'X-SP-USER': `${authKey}|${process.env.synapseUserID}`
  })

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
                headers: getHeaders(),
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
                  }
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

    oauthUser: {
      schema: [
        ['data', true, [['userID', true, 'integer'], ['synapseUserID']]]
      ],
      async method (ctx) {
        const {
          data: { userID, synapseUserID: synapseUserIdProvided }
        } = ctx.request.body

        const reply = { userID, synapseUserID: synapseUserIdProvided }
        try {
          let synapseUserID = synapseUserIdProvided
          if (!synapseUserID) {
            const synapseEntry = await SynapseEntry.findOne({
              where: { userID }
            })
            if (synapseEntry) {
              synapseUserID = synapseEntry.synapseUserID
            }
          }

          if (synapseUserID) {
            reply.synapseUserID = synapseUserID

            const { refresh_token: refreshToken } = await request.get({
              uri: `${config.constants.SYNAPSE_API_URL}/users/${synapseUserID}`,
              headers: getHeaders(),
              json: true
            })
            console.log(refreshToken)

            const { oauth_key: oauth } = await request.post({
              uri: `${config.constants.SYNAPSE_API_URL}/oauth/${synapseUserID}`,
              headers: getHeaders(),
              body: {
                refresh_token: refreshToken
              },
              json: true
            })
            console.log(oauth)

            reply.oauth = oauth
          } else {
            reply.error = true
            reply.errorCode = 'no_synapse_user_id'
          }
        } catch (e) {
          reply.error = true
          reply.errorCode = 'try_catched'
          reply.errorData = e
        }

        ctx.body = reply
      }
    },

    addDocument: {
      schema: [
        [
          'data',
          true,
          [
            ['userID', true, 'integer'],
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
        const { data: documentsToSubmit } = ctx.request.body

        const {
          userID,
          legalName,
          email,
          phone,
          address: { street, city, subdivision, zipCode, countryCode },
          dob,
          ssn,
          govID
        } = documentsToSubmit

        const reply = {}
        try {
          const user = await User.findOne({
            include: [SynapseEntry],
            where: { id: userID }
          })
          if (user) {
            console.log('----------Calling Synapse API-------')

            const synapseEntry = user.getSynapseEntry()
            synapseEntry.documentsToSubmit = documentsToSubmit
            await synapseEntry.save()

            const { oauth } = await request.post({
              uri: `${config.constants.URL}/admin/synapse-oauth-user`,
              body: {
                secret: process.env.apiSecret,
                data: {
                  userID,
                  synapseUserID: synapseEntry.synapseUserID
                }
              },
              json: true
            })

            const dobMoment = moment(dob)

            const res = await request.patch({
              uri: `${config.constants.SYNAPSE_API_URL}/users/${
                synapseEntry.synapseUserID
              }`,
              headers: getHeaders(oauth),
              body: {
                documents: [
                  {
                    name: legalName,
                    email,
                    phone_number: phone,
                    // TODO: ip should belong to user
                    ip: '::1',
                    entity_type: 'NOT_KNOWN',
                    entity_scope: 'Not Known',
                    day: dobMoment.date(),
                    month: dobMoment.month(),
                    year: dobMoment.year(),
                    address_street: street,
                    address_city: city,
                    address_subdivision: subdivision,
                    address_postal_code: zipCode,
                    address_country_code: countryCode,
                    virtual_docs: [
                      {
                        document_value: ssn,
                        document_type: 'SSN'
                      }
                    ],
                    physical_docs: [
                      {
                        document_value: govID,
                        document_type: 'GOVT_ID'
                      }
                    ]
                  }
                ]
              },
              json: true
            })

            console.log(res)
          } else {
            reply.error = true
            reply.errorCode = 'user_not_found'
          }
        } catch (e) {
          console.log(e)
          reply.error = true
          reply.errorCode = 'try_catched'
        }

        ctx.body = reply
      }
    }
  }
}
