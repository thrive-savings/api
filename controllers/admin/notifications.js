module.exports = (
  Sequelize,
  User,
  Notification,
  Expo,
  mail,
  moment,
  request,
  config,
  Sentry
) => ({
  push: {
    schema: [
      [
        'data',
        true,
        [
          [
            'message',
            true,
            [['title', true], ['body', true], ['data', 'object']]
          ],
          ['userIds', true, 'array']
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: {
          message: { title, body, data },
          userIds
        }
      } = ctx.request.body

      const users = await User.findAll({
        where: { id: { [Sequelize.Op.in]: userIds } }
      })

      const expo = new Expo()

      let messages = []
      for (let { expoPushToken } of users) {
        if (!Expo.isExpoPushToken(expoPushToken)) {
          console.log(
            `Push token ${expoPushToken} is not a valid Expo push token`
          )
          continue
        }

        messages.push({
          to: expoPushToken,
          sound: 'default',
          title: title || 'Test',
          body: body || 'This is a test notification',
          data: data || {},
          badge: 1
        })
      }

      let chunks = expo.chunkPushNotifications(messages)
      let tickets = []

      for (let chunk of chunks) {
        try {
          let ticketChunk = await expo.sendPushNotificationsAsync(chunk)
          if (ticketChunk.constructor === Array && ticketChunk.length) {
            ticketChunk = ticketChunk[0]
          }

          if (ticketChunk.details && ticketChunk.details.error) {
            // NOTE: If a ticket contains an error code in ticket.details.error, you
            // must handle it appropriately. The error codes are listed in the Expo
            // documentation:
            // https://docs.expo.io/versions/latest/guides/push-notifications#response-format
            const errorCode = ticketChunk.details.error
            if (errorCode === 'DeviceNotRegistered') {
              await User.update(
                { expoPushToken: 'DeviceNotRegistered' },
                { where: { expoPushToken: chunk[0].to } }
              )
            }
            Sentry.captureException(ticketChunk.details)
            continue
          }

          tickets.push(...ticketChunk)
        } catch (error) {
          Sentry.captureException(error)
        }
      }

      // Run after 15 minutes to check the status
      setTimeout(
        async requestedTickets => {
          let receiptIds = []
          for (let ticket of requestedTickets) {
            // NOTE: Not all tickets have IDs; for example, tickets for notifications
            // that could not be enqueued will have error information and no receipt ID.
            if (ticket.id) {
              receiptIds.push(ticket.id)
            }
          }

          let receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds)
          for (let chunk of receiptIdChunks) {
            try {
              let receipts = await expo.getPushNotificationReceiptsAsync(chunk)
              console.log(receipts)

              // The receipts specify whether Apple or Google successfully received the
              // notification and information about an error, if one occurred.
              for (let receipt of receipts) {
                if (receipt.status === 'ok') {
                  continue
                } else if (receipt.status === 'error') {
                  if (receipt.details && receipt.details.error) {
                    // The error codes are listed in the Expo documentation:
                    // https://docs.expo.io/versions/latest/guides/push-notifications#response-format
                    // You must handle the errors appropriately.
                    const errorCode = receipt.details.error
                    if (errorCode === 'DeviceNotRegistered') {
                      await User.update(
                        { expoPushToken: 'DeviceNotRegistered' },
                        { where: { expoPushToken: chunk[0].to } }
                      )
                    }
                    Sentry.captureException(receipt.details)
                  }
                }
              }
            } catch (error) {
              Sentry.captureException(error)
            }
          }
        },
        900000,
        tickets
      )

      ctx.body = {}
    }
  },

  email: {
    schema: [
      ['data', true, [['userIds', true, 'array'], ['template'], ['subject']]]
    ],
    async method (ctx) {
      const {
        data: { userIds, template, subject }
      } = ctx.request.body

      const users = await User.findAll({
        where: { id: { [Sequelize.Op.in]: userIds } }
      })

      for (const { email, firstName } of users) {
        mail.send(
          {
            from: 'help@thrivesavings.com',
            subject: subject || 'Thrive Email',
            to: email
          },
          template || 'relink',
          { user: { firstName } }
        )
      }

      ctx.body = {}
    },
    onError (err) {
      Sentry.captureException(err)
    }
  },

  fire: {
    async method (ctx) {
      const now = moment()
      const notifications = await Notification.findAll({
        where: {
          fireDate: { [Sequelize.Op.lte]: now.toDate() }
        }
      })

      let notificationsToDelete = []
      for (const notification of notifications) {
        if (notificationsToDelete.includes(notification.id)) {
          continue
        }

        const { userID, condition, conditionModel, event } = notification

        let user = await User.findOne({ where: { id: userID } })
        let conditionHolds = true

        if (conditionModel === 'users') {
          condition.id = userID
          user = await User.findOne({
            where: condition
          })
        }

        if (user && conditionHolds) {
          // Condition still holds, so Fire Notification
          const {
            channel,
            message,
            smsFallbackMessage,
            recurAfter,
            recurAfterWord,
            recurCount
          } = notification

          if (channel === 'sms') {
            user.sendMessage(message.body)
          } else if (channel === 'email') {
            const { template, subject } = message
            await request.post({
              uri: `${config.constants.URL}/admin/notifications-email`,
              body: {
                secret: process.env.apiSecret,
                data: { userIds: [user.id], template, subject }
              },
              json: true
            })
          } else if (channel === 'push') {
            if (
              user.expoPushToken &&
              Expo.isExpoPushToken(user.expoPushToken)
            ) {
              await request.post({
                uri: `${config.constants.URL}/admin/notifications-push`,
                body: {
                  secret: process.env.apiSecret,
                  data: { userIds: [user.id], message }
                },
                json: true
              })
            } else {
              // Fallback to SMS
              user.sendMessage(smsFallbackMessage || message.body)
            }
          }

          if (recurAfter && recurCount > 1) {
            notification.update({
              fireDate: now.add(recurAfter, recurAfterWord).toDate(),
              recurCount: recurCount - 1
            })
            continue
          }
          notificationsToDelete.push(notification.id)
        } else {
          // Condition no longer holds so clean all related notifications
          await Notification.destroy({ where: { userID, event } })
        }
      }

      // Delete notificationsToDelete
      if (notificationsToDelete.length) {
        await Notification.destroy({
          where: { id: { [Sequelize.Op.in]: notificationsToDelete } }
        })
      }

      ctx.body = {}
    },
    onError (err) {
      Sentry.captureException(err)
    }
  },

  scheduleUnlink: {
    schema: [['data', true, [['userID', true, 'integer']]]],
    async method (ctx) {
      const {
        data: { userID }
      } = ctx.request.body

      const event = 'unlink'
      const user = await User.findOne({ where: { id: userID } })

      // Destroy all related events created on previous schedules
      await Notification.destroy({
        where: { userID, event }
      })

      const msg =
        'For your security, we need you to authenticate your bank account again. Please open the Thrive app to continue saving.'
      const condition = {
        $or: {
          bankLinked: false,
          relinkRequired: true
        }
      }

      let fireDate = moment().add(2, 'days')
      await Notification.create({
        userID,
        channel: 'push',
        message: {
          title: 'Relink Bank',
          body: msg
        },
        condition,
        fireDate: fireDate.toDate(),
        description: 'Relink Bank Push Notification',
        smsFallbackMessage: `Hi ${user.firstName}. ${msg}`,
        event
      })

      fireDate.add(3, 'days')
      await Notification.create({
        userID,
        channel: 'email',
        message: {
          template: 'relink'
        },
        condition,
        fireDate: fireDate.toDate(),
        description: 'Relink Bank Email Notification',
        event
      })

      fireDate.add(3, 'days')
      await Notification.create({
        userID,
        channel: 'sms',
        message: {
          body: `Hi ${user.firstName}. ${msg}`
        },
        condition,
        fireDate: fireDate.toDate(),
        description: 'Relink Bank Weekly SMS Notification',
        event,
        recurAfter: 7,
        recurCount: 3,
        recurAfterWord: 'days'
      })

      ctx.body = {}
    },
    onError (err) {
      console.log('--got error ---')
      // Sentry.captureException(err)
      console.log(err)
    }
  }
})
