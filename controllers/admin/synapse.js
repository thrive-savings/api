module.exports = (
  User,
  Account,
  Transaction,
  SynapseEntry,
  SynapseNode,
  moment,
  request,
  config,
  ConstantsService,
  HelpersService
) => {
  const FAKE_ADDRESS = {
    address_street: '1 Market St.',
    address_city: 'San Francisco',
    address_subdivision: 'CA',
    address_postal_code: '94114',
    address_country_code: 'US'
  }

  const { NODE_TYPES } = ConstantsService.SYNAPSE

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
                headers: HelpersService.getSynapseHeaders(),
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
              headers: HelpersService.getSynapseHeaders(),
              json: true
            })
            console.log(refreshToken)

            const { oauth_key: oauth } = await request.post({
              uri: `${config.constants.SYNAPSE_API_URL}/oauth/${synapseUserID}`,
              headers: HelpersService.getSynapseHeaders(),
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
            ['govID', true, [['encodedImage', true], ['imageType', true]]]
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
          govID: { encodedImage, imageType }
        } = documentsToSubmit

        const reply = {}
        try {
          const user = await User.findOne({
            include: [SynapseEntry],
            where: { id: userID }
          })
          if (user) {
            const synapseEntry = user.getSynapseEntry()
            synapseEntry.documentsToSubmit = documentsToSubmit
            await synapseEntry.save()

            const dobMoment = moment(dob)

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

            if (oauth) {
              await request.patch({
                uri: `${config.constants.SYNAPSE_API_URL}/users/${
                  synapseEntry.synapseUserID
                }`,
                headers: HelpersService.getSynapseHeaders(oauth),
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
            } else {
              reply.error = true
              reply.errorCode = 'oauth_not_returned'
            }
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
    },

    createAchNode: {
      schema: [
        [
          'data',
          true,
          [['userID', true, 'integer'], ['accountID', true, 'integer']]
        ]
      ],
      async method (ctx) {
        const {
          data: { userID, accountID }
        } = ctx.request.body

        const reply = { userID, accountID }
        try {
          const user = await User.findOne({
            include: [SynapseEntry],
            where: { id: userID }
          })
          if (user) {
            const synapseEntry = user.getSynapseEntry()
            if (synapseEntry) {
              const synapseNode = await SynapseNode.findOne({
                where: { accountID }
              })
              if (!synapseNode) {
                const account = await Account.findOne({ id: accountID })
                if (account) {
                  // TODO: clean up here

                  /* const transactions = await Transaction.findAll({
                    where: { accountID },
                    order: [['date', 'DESC']],
                    limit: 15
                  }) */

                  /* eslint-disable */
                  const transactions = [
                    {"id":"82590","value":"-65000","date":"2019-06-17 00:00:00+00","description":"EFT Withdrawal to CDN SHR INVEST","type":"C","account_id":"659","fees":"0","category":"Uncategorized","subcategory":"Uncategorized","subtype":"WITH","is_cancel":"False","is_pending":"False","quovo_account_id":"42827622","quovo_transaction_id":"5519541942","quovo_connection_id":"9933568","quovo_user_id":"8240061","transaction_type":"debit"},
                    {"id":"82588","value":"-57400","date":"2019-06-17 00:00:00+00","description":"Cheque Withdrawal - 058","type":"C","account_id":"659","fees":"0","category":"Uncategorized","subcategory":"Uncategorized","subtype":"WITH","is_cancel":"False","is_pending":"False","quovo_account_id":"42827622","quovo_transaction_id":"5519541944","quovo_connection_id":"9933568","quovo_user_id":"8240061","transaction_type":"debit"},
                    {"id":"82583","value":"130000","date":"2019-06-17 00:00:00+00","description":"Internet Deposit from Tangerine Savings Account - NOMOS - 3029006112","type":"C","account_id":"659","fees":"0","category":"Account Transfer","subcategory":"Emergency Savings","subtype":"DEPO","is_cancel":"False","is_pending":"False","quovo_account_id":"42827622","quovo_transaction_id":"5519541941","quovo_connection_id":"9933568","quovo_user_id":"8240061","transaction_type":"credit"},
                    {"id":"82580","value":"-500","date":"2019-06-17 00:00:00+00","description":"Overdraft Fee","type":"I","account_id":"659","fees":"0","category":"Account Fees","subcategory":"Overdraft Fee","subtype":"MCFE","is_cancel":"False","is_pending":"False","quovo_account_id":"42827622","quovo_transaction_id":"5519541945","quovo_connection_id":"9933568","quovo_user_id":"8240061","transaction_type":"debit"},
                    {"id":"82579","value":"-130000","date":"2019-06-17 00:00:00+00","description":"Internet Withdrawal to Tangerine Chequing Account - 4001887306","type":"C","account_id":"661","fees":"0","category":"Uncategorized","subcategory":"Uncategorized","subtype":"WITH","is_cancel":"False","is_pending":"False","quovo_account_id":"42827626","quovo_transaction_id":"5519541936","quovo_connection_id":"9933568","quovo_user_id":"8240061","transaction_type":"debit"},
                    {"id":"82582","value":"-15000","date":"2019-06-17 00:00:00+00","description":"EFT Withdrawal to Thrive Savings","type":"C","account_id":"659","fees":"0","category":"Account Transfer","subcategory":"Emergency Savings","subtype":"WITH","is_cancel":"False","is_pending":"False","quovo_account_id":"42827622","quovo_transaction_id":"5519541943","quovo_connection_id":"9933568","quovo_user_id":"8240061","transaction_type":"debit"},
                    {"id":"82578","value":"2358","date":"2019-06-15 00:00:00+00","description":"Credit Card Rewards Redemption","type":"C","account_id":"664","fees":"0","category":"Other Income","subcategory":"Other Income","subtype":"DEPO","is_cancel":"False","is_pending":"False","quovo_account_id":"42827623","quovo_transaction_id":"5515682189","quovo_connection_id":"9933568","quovo_user_id":"8240061","transaction_type":"credit"},
                    {"id":"82577","value":"300000","date":"2019-06-14 00:00:00+00","description":"Internet Deposit from Tangerine Chequing Account - 4001887306","type":"C","account_id":"661","fees":"0","category":"Other Income","subcategory":"Other Income","subtype":"DEPO","is_cancel":"False","is_pending":"False","quovo_account_id":"42827626","quovo_transaction_id":"5515682188","quovo_connection_id":"9933568","quovo_user_id":"8240061","transaction_type":"credit"},
                    {"id":"82585","value":"-300000","date":"2019-06-14 00:00:00+00","description":"Internet Withdrawal to Tangerine Savings Account - NOMOS - 3029006112","type":"C","account_id":"659","fees":"0","category":"Account Transfer","subcategory":"Emergency Savings","subtype":"WITH","is_cancel":"False","is_pending":"False","quovo_account_id":"42827622","quovo_transaction_id":"5515682190","quovo_connection_id":"9933568","quovo_user_id":"8240061","transaction_type":"debit"},
                    {"id":"82592","value":"42300","date":"2019-06-13 00:00:00+00","description":"PAYMENT - THANK YOU","type":"C","account_id":"660","fees":"0","category":"Other Income","subcategory":"Other Income","subtype":"DEPO","is_cancel":"False","is_pending":"False","quovo_account_id":"42827631","quovo_transaction_id":"5509726057","quovo_connection_id":"9933568","quovo_user_id":"8240061","transaction_type":"credit"},
                    {"id":"82593","value":"46414","date":"2019-06-13 00:00:00+00","description":"PAYMENT - THANK YOU","type":"C","account_id":"660","fees":"0","category":"Other Income","subcategory":"Other Income","subtype":"DEPO","is_cancel":"False","is_pending":"False","quovo_account_id":"42827631","quovo_transaction_id":"5509726056","quovo_connection_id":"9933568","quovo_user_id":"8240061","transaction_type":"credit"},
                    {"id":"82584","value":"228427","date":"2019-06-13 00:00:00+00","description":"EFT Deposit from Thrive Savings","type":"C","account_id":"659","fees":"0","category":"Account Transfer","subcategory":"Emergency Savings","subtype":"DEPO","is_cancel":"False","is_pending":"False","quovo_account_id":"42827622","quovo_transaction_id":"5509726055","quovo_connection_id":"9933568","quovo_user_id":"8240061","transaction_type":"credit"},
                    {"id":"82581","value":"-46414","date":"2019-06-13 00:00:00+00","description":"TNG Money-Back Credit Card payment","type":"C","account_id":"659","fees":"0","category":"Account Transfer","subcategory":"Credit Card","subtype":"WITH","is_cancel":"False","is_pending":"False","quovo_account_id":"42827622","quovo_transaction_id":"5509726059","quovo_connection_id":"9933568","quovo_user_id":"8240061","transaction_type":"debit"},
                    {"id":"82587","value":"-99598","date":"2019-06-13 00:00:00+00","description":"Bill Payment - AMERICAN EXPRESS CREDIT CARD - ***********1004","type":"C","account_id":"659","fees":"0","category":"Bills/Utilities","subcategory":"Other Bills/Utilities","subtype":"WITH","is_cancel":"False","is_pending":"False","quovo_account_id":"42827622","quovo_transaction_id":"5509726058","quovo_connection_id":"9933568","quovo_user_id":"8240061","transaction_type":"debit"},
                    {"id":"82594","value":"-5650","date":"2019-06-11 00:00:00+00","description":"BEANFIELD TECHNOLOGIES","type":"C","account_id":"660","fees":"0","category":"Uncategorized","subcategory":"Uncategorized","subtype":"WITH","is_cancel":"False","is_pending":"False","quovo_account_id":"42827631","quovo_transaction_id":"5505846558","quovo_connection_id":"9933568","quovo_user_id":"8240061","transaction_type":"debit"}
                  ]
                  /* eslint-enable */

                  reply.transactionCount = transactions
                    ? transactions.length
                    : 0
                  if (transactions && transactions.length >= 10) {
                    let curBalance = account.getBalance()
                    const transactionsToSubmit = []
                    for (const {
                      value,
                      description,
                      date,
                      isPending
                    } of transactions) {
                      const numberValue = +value
                      transactionsToSubmit.push({
                        current_balance: curBalance,
                        description,
                        amount: Math.abs(numberValue) / 100,
                        date: moment(date).unix(),
                        pending: isPending,
                        debit: numberValue > 0
                      })
                      curBalance += numberValue
                    }

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

                    if (oauth) {
                      const suppID = `THRIVE${
                        process.env.NODE_ENV !== 'production' ? '_DEV' : ''
                      }_${userID}_ACH_${accountID}`

                      const {
                        error_code: synapseErrorCode,
                        success,
                        nodes: [node]
                      } = await request.post({
                        uri: `${config.constants.SYNAPSE_API_URL}/users/${
                          synapseEntry.synapseUserID
                        }/nodes`,
                        headers: HelpersService.getSynapseHeaders(oauth),
                        body: {
                          type: NODE_TYPES.ACH_US,
                          info: {
                            nickname: account.id === 684 ? 'Chime Checking' : account.id === 685 ? 'Everyday Checking' : account.id === 686 ? 'Total Checking' : account.nickname, // account.nickname,
                            account_num: account.number,
                            routing_num: account.id === 684 ? '031101279' : account.id === 685 ? '073000228' : account.id === 686 ? '122100024' : account.routing, // account.routing,
                            type: 'PERSONAL',
                            class: 'CHECKING'
                          },
                          extra: {
                            other: {
                              transactions: transactionsToSubmit
                            },
                            supp_id: suppID
                          }
                        },
                        json: true
                      })

                      console.log(node)
                      if (success) {
                        const {
                          _id: synapseNodeID,
                          allowed,
                          extra,
                          info,
                          is_active: isActive,
                          timeline,
                          type,
                          user_id: synapseUserID
                        } = node

                        const synapseNodeCreated = await SynapseNode.create({
                          type,
                          allowed,
                          info,
                          extra,
                          isActive,
                          timeline,
                          synapseNodeID,
                          synapseUserID,
                          accountID,
                          userID
                        })
                        reply.data = synapseNodeCreated.getData()
                      } else {
                        reply.error = true
                        reply.errorCode = 'synapse_node_creation_failed'
                        reply.synapseErrorCode = synapseErrorCode
                      }
                    } else {
                      reply.error = true
                      reply.errorCode = 'oauth_not_returned'
                    }
                  } else {
                    reply.error = true
                    reply.errorCode = 'not_enough_transactions'
                  }
                } else {
                  reply.error = true
                  reply.errorCode = 'account_not_found'
                }
              } else {
                reply.error = true
                reply.errorCode = 'synapse_node_already_exists'
              }
            } else {
              reply.error = true
              reply.errorCode = 'synapse_entry_not_found'
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

        console.log(reply)

        ctx.body = reply
      }
    },

    createDepositNode: {
      schema: [['data', true, [['userID', true, 'integer']]]],
      async method (ctx) {
        const { data: { userID } } = ctx.request.body

        const reply = { userID }
        try {
          const user = await User.findOne({ include: [SynapseEntry], where: { id: userID } })
          if (user) {
            const synapseEntry = user.getSynapseEntry()
            if (synapseEntry) {
              let synapseNode = await SynapseNode.findOne({ where: { userID, type: ConstantsService.SYNAPSE.NODE_TYPES.DEPOSIT_US } })
              if (!synapseNode) {
                const { id: baseDocID } = synapseEntry.getDocumentsData()
                if (baseDocID && synapseEntry.permission === 'SEND-AND-RECEIVE') {
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

                  if (oauth) {
                    const suppID = `THRIVE${
                      process.env.NODE_ENV !== 'production' ? '_DEV' : ''
                    }_${userID}_DEPOSIT`

                    const {
                      error_code: synapseErrorCode,
                      success,
                      nodes: [node]
                    } = await request.post({
                      uri: `${config.constants.SYNAPSE_API_URL}/users/${
                        synapseEntry.synapseUserID
                      }/nodes`,
                      headers: HelpersService.getSynapseHeaders(oauth),
                      body: {
                        type: NODE_TYPES.DEPOSIT_US,
                        info: {
                          nickname: `${user.firstName}'s Thrive Account`,
                          document_id: baseDocID
                        },
                        extra: {
                          supp_id: suppID
                        }
                      },
                      json: true
                    })

                    console.log(node)
                    if (success) {
                      const {
                        _id: synapseNodeID,
                        allowed,
                        extra,
                        info,
                        is_active: isActive,
                        timeline,
                        type,
                        user_id: synapseUserID
                      } = node

                      const synapseNodeCreated = await SynapseNode.create({
                        type,
                        allowed,
                        info,
                        extra,
                        isActive,
                        timeline,
                        synapseNodeID,
                        synapseUserID,
                        userID
                      })
                      reply.data = synapseNodeCreated.getData()
                    } else {
                      reply.error = true
                      reply.errorCode = 'synapse_node_creation_failed'
                      reply.synapseErrorCode = synapseErrorCode
                    }
                  } else {
                    reply.error = true
                    reply.errorCode = 'oauth_not_returned'
                  }
                } else {
                  reply.error = true
                  reply.errorCode = 'kyc_incomplete'
                }
              } else {
                reply.error = true
                reply.errorCode = 'synapse_deposit_node_already_exists'
              }
            } else {
              reply.error = true
              reply.errorCode = 'synapse_entry_not_found'
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
    }
  }
}
