module.exports = (User, amplitude) => ({
  setWorkType: {
    schema: [['data', true, [['workType', true]]]],
    async method (ctx) {
      const {
        data: { workType }
      } = ctx.request.body

      await User.update({ workType }, { where: { id: ctx.authorized.id } })

      amplitude.track({
        eventType: 'WORK_TYPE_SET',
        userId: ctx.authorized.id,
        userProperties: {
          'Work Type': workType
        }
      })

      ctx.body = { data: { workType } }
    }
  },
  setSavingType: {
    schema: [['data', true, [['savingType', true]]]],
    async method (ctx) {
      const {
        data: { savingType }
      } = ctx.request.body

      let updateData = { savingType }
      if (savingType === 'Thrive Flex') {
        updateData.fetchFrequency = 'ONCEWEEKLY'
      }
      await User.update(updateData, { where: { id: ctx.authorized.id } })

      amplitude.track({
        eventType: 'SAVING_TYPE_SET',
        userId: ctx.authorized.id,
        userProperties: {
          'Saving Type': savingType
        }
      })

      ctx.body = { data: { savingType } }
    }
  },
  setSavingDetails: {
    schema: [
      [
        'data',
        true,
        [['nextSaveDate'], ['fixedContribution', true], ['frequency', true]]
      ]
    ],
    async method (ctx) {
      const {
        data: { nextSaveDate, fixedContribution, frequency }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: ctx.authorized.id } })
      const update = {
        fixedContribution,
        fetchFrequency: frequency
      }
      if (nextSaveDate) {
        update.nextSaveDate = new Date(nextSaveDate)
      }
      await user.update(update)

      amplitude.track({
        eventType: 'SAVING_FIXED_DETAILS_SET',
        userId: ctx.authorized.id
      })

      ctx.body = {
        data: {
          nextSaveDate: user.nextSaveDate,
          fixedContribution: user.fixedContribution,
          frequency: user.frequency
        }
      }
    }
  },
  initialSetDone: {
    async method (ctx) {
      await User.update(
        { savingPreferencesSet: true },
        { where: { id: ctx.authorized.id } }
      )

      amplitude.identify({
        userId: ctx.authorized.id,
        userProperties: {
          'Saving Preferences Set': true
        }
      })

      ctx.body = {}
    }
  }
})
