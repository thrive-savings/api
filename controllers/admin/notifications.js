module.exports = (
  Sequelize,
  User,
  Notification,
  Expo,
  mail,
  moment,
  request,
  config
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
          console.log(ticketChunk)

          if (ticketChunk.details && ticketChunk.details.error) {
            // NOTE: If a ticket contains an error code in ticket.details.error, you
            // must handle it appropriately. The error codes are listed in the Expo
            // documentation:
            // https://docs.expo.io/versions/latest/guides/push-notifications#response-format
            console.log(`The error code is ${ticketChunk.details.error}`)
            continue
          }

          tickets.push(...ticketChunk)
        } catch (error) {
          console.log(error)
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
                  console.log(
                    `There was an error sending a notification: ${
                      receipt.message
                    }`
                  )
                  if (receipt.details && receipt.details.error) {
                    // The error codes are listed in the Expo documentation:
                    // https://docs.expo.io/versions/latest/guides/push-notifications#response-format
                    // You must handle the errors appropriately.
                    console.log(`The error code is ${receipt.details.error}`)
                  }
                }
              }
            } catch (error) {
              console.log(error)
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

      for (const { email } of users) {
        mail.send(
          {
            from: 'help@thrivesavings.com',
            subject: subject || 'Thrive Email',
            to: email
          },
          template || 'relink'
        )
      }

      ctx.body = {}
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

        const condition = notification.condition
        condition.id = notification.userID

        const user = await User.findOne({
          where: condition
        })
        if (user) {
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
          let rootNotificationID = notification.id
          if (notification.rootNotificationID) {
            rootNotificationID = notification.rootNotificationID
          } else {
            notificationsToDelete.push(rootNotificationID)
          }

          const relatedNotifications = await Notification.findAll({
            where: { rootNotificationID }
          })
          if (relatedNotifications) {
            relatedNotifications.forEach(relatedNotification => {
              notificationsToDelete.push(relatedNotification.id)
            })
          }
        }
      }

      // Delete notificationsToDelete
      if (notificationsToDelete.length) {
        await Notification.destroy({
          where: { id: { [Sequelize.Op.in]: notificationsToDelete } }
        })
      }

      ctx.body = {}
    }
  }
})
