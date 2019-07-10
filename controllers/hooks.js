module.exports = (
  User,
  Account,
  Transfer,
  SynapseEntry,
  SynapseNode,
  ConstantsService,
  moment,
  amplitude,
  request,
  config
) => {
  const { STATES } = ConstantsService.TRANSFER

  return {
    versapay: {
      async method (ctx) {
        const reply = {}
        try {
          const {
            type,
            token,
            state: stateRaw,
            transaction_type: transactionType,
            unique_reference: uuid,
            from_fund_token: fromFundToken,
            to_fund_token: toFundToken
          } = ctx.request.body

          if (type === 'transaction') {
            const transfer = await Transfer.findOne({
              include: [User],
              where: { uuid }
            })
            if (transfer) {
              reply.transferID = transfer.id
              reply.userID = transfer.userID
              reply.stateRaw = stateRaw

              const timeline = transfer.timeline
              const timelineEntry = { date: moment(), stateRaw }
              let state = transfer.state
              switch (stateRaw) {
                case 'in_progress':
                  state = STATES.PROCESSING
                  timelineEntry.note = 'Getting processed by the provider'
                  break
                case 'completed':
                  state = STATES.COMPLETED
                  timelineEntry.note = 'Settled'
                  break
                case 'cancelled':
                  state = STATES.CANCELED
                  timelineEntry.note = 'Canceled through the provider'
                  break
                case 'error':
                  state = STATES.FAILED
                  timelineEntry.note = 'Failed to process by the provider'
                  break
                case 'rejected':
                case 'nsfed':
                case 'completed_but_nsfed':
                  state = STATES.RETURNED
                  timelineEntry.note = 'Rejected through the provider'
                  break
                default:
                  timelineEntry.note =
                    'Unhandled state is passed to the webhook'
              }
              timelineEntry.state = state
              timeline.push(timelineEntry)

              transfer.timeline = timeline
              transfer.state = state
              transfer.stateRaw = stateRaw
              transfer.platformID = token
              await transfer.save()

              const { user, amount, type, subtype } = transfer

              reply.state = state
              reply.type = type
              reply.subtype = subtype

              // Set VersaPay Token for Account
              const accountID = transfer.getCanadianAccountID()
              const accountVersapayToken =
                transactionType === 'direct_debit' ? fromFundToken : toFundToken
              const account = await Account.findOne({
                where: { id: accountID }
              })
              if (account && account.versapay_token !== accountVersapayToken) {
                account.versapay_token = accountVersapayToken
                await account.save()
              }

              // Update & Notify User
              if ([STATES.COMPLETED, STATES.PROCESSING].includes(state)) {
                if (state === STATES.COMPLETED) {
                  user.updateBalance(amount, type)
                }
                user.notifyAboutTransfer(amount, subtype, state)
              } else if (stateRaw === 'completed_but_nsfed') {
                user.undoBalanceUpdate(amount, type)
              }
            } else {
              reply.error = true
              reply.errorCode = 'transfer_not_found'
              reply.uuid = uuid
            }
          } else {
            reply.error = true
            reply.errorCode = 'incorrect_request_type'
          }
        } catch (e) {
          reply.error = true
          reply.errorCode = 'try_catched'
          reply.errorData = e
        }

        if (reply.error) {
          reply.requestBody = JSON.stringify(ctx.request.body)
        }

        amplitude.track({
          eventType: `VERSAPAY_HOOK_${reply.error ? 'FAIL' : 'SUCCEED'}`,
          userId: reply.userID ? reply.userID : 'server',
          eventProperties: reply
        })
        request.post({
          uri: process.env.slackWebhookURL,
          body: {
            text: `VersaPay Hook: *${
              reply.error
                ? `FAIL - ${reply.errorCode}${
                  reply.errorMessage ? ` - ${reply.errorMessage}` : ''
                }`
                : `SUCCEED`
            }*${reply.stateRaw ? ` | State: *${reply.stateRaw}*` : ''}${
              reply.transferID ? ` | Transfer ${reply.transferID}` : ''
            }${reply.userID ? ` | User ${reply.userID}` : ''}`
          },
          json: true
        })

        ctx.body = reply
      }
    },

    synapse: {
      async method (ctx) {
        console.log(
          '----------------------------Synapse Hook-------------------------'
        )

        const reply = {}
        try {
          const req = ctx.request.body
          const {
            webhook_meta: { function: event }
          } = req
          reply.event = event

          console.log(req)
          if (event === 'USER|PATCH') {
            const {
              _id: synapseUserID,
              permission,
              documents,
              doc_status: docStatus,
              extra
            } = req._rest

            const synapseEntry = await SynapseEntry.findOne({
              where: { synapseUserID }
            })
            if (synapseEntry) {
              reply.userID = synapseEntry.userID
              await synapseEntry.update({
                permission,
                documents,
                docStatus,
                extra
              })
              reply.updatedData = synapseEntry.getData()

              // TODO: figure out where to trust to get the full KYC status, for now checking SynapseEntry.permission
              if (synapseEntry.permission === 'SEND-AND-RECEIVE') {
                console.log('------Calling to Create Deposit Account-------')
                request.post({
                  uri: `${
                    config.constants.URL
                  }/admin/synapse-create-deposit-node`,
                  body: {
                    secret: process.env.apiSecret,
                    data: {
                      userID: synapseEntry.userID
                    }
                  },
                  json: true
                })
              }
            } else {
              reply.error = true
              reply.errorCode = 'synapse_entry_not_found'
            }
          } else if (event === 'NODE|PATCH') {
            const {
              _id: synapseNodeID,
              info,
              allowed,
              type,
              extra,
              is_active: isActive,
              timeline,
              user_id: synapseUserID
            } = req._rest

            const synapseNode = await SynapseNode.findOne({
              where: { synapseNodeID, synapseUserID }
            })
            if (synapseNode) {
              reply.userID = synapseNode.userID
              await synapseNode.update({
                type,
                allowed,
                timeline,
                info,
                extra,
                isActive
              })
              reply.updatedData = synapseNode.getData()
            } else {
              reply.error = true
              reply.errorCode = 'synapse_node_not_found'
            }
          }
        } catch (e) {
          console.log(e)
          reply.error = true
          reply.errorCode = 'try_catched'
          reply.errorData = e
        }

        amplitude.track({
          eventType: `SYNAPSE_HOOK_${reply.error ? 'FAIL' : 'SUCCEED'}`,
          userId: reply.userID ? reply.userID : 'server',
          eventProperties: reply
        })
        request.post({
          uri: process.env.slackWebhookURL,
          body: {
            text: `Synapse Hook: *${
              reply.error
                ? `FAIL - ${reply.errorCode}${
                  reply.errorMessage ? ` - ${reply.errorMessage}` : ''
                }`
                : `SUCCEED`
            }*${reply.event ? ` | Event: *${reply.event}*` : ''}${
              reply.transferID ? ` | Transfer ${reply.transferID}` : ''
            }${reply.userID ? ` | User ${reply.userID}` : ''}`
          },
          json: true
        })

        ctx.body = reply
      }
    }
  }
}
