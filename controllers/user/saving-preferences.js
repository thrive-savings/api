module.exports = (User, amplitude) => ({
  setWorkType: {
    schema: [['data', true, [['workType', true]]]],
    async method (ctx) {
      const {
        data: { workType }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: ctx.authorized.id } })
      user.workType = workType
      await user.save()

      amplitude.track({
        eventType: 'WORK_TYPE_SET',
        userId: ctx.authorized.id,
        userProperties: {
          'Work Type': workType
        }
      })

      ctx.body = { data: { savingPreferences: user.getSavingPreferences() } }
    }
  },
  setSavingType: {
    schema: [['data', true, [['savingType', true]]]],
    async method (ctx) {
      const {
        data: { savingType }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: ctx.authorized.id } })
      user.savingType = savingType
      if (savingType === 'Thrive Flex') {
        user.fetchFrequency = 'ONCEWEEKLY'
      }
      await user.save()

      amplitude.track({
        eventType: 'SAVING_TYPE_SET',
        userId: ctx.authorized.id,
        userProperties: {
          'Saving Type': savingType
        }
      })

      ctx.body = { data: { savingPreferences: user.getSavingPreferences() } }
    }
  },
  setSavingDetails: {
    schema: [
      [
        'data',
        true,
        [['nextSaveDate'], ['fixedContribution'], ['frequency']]
      ]
    ],
    async method (ctx) {
      const {
        data: { nextSaveDate, fixedContribution, frequency }
      } = ctx.request.body

      const user = await User.findOne({ where: { id: ctx.authorized.id } })
      if (nextSaveDate) {
        user.nextSaveDate = new Date(nextSaveDate)
      }
      if (fixedContribution) {
        user.fixedContribution = fixedContribution
      }
      if (frequency) {
        user.fetchFrequency = frequency
      }
      await user.save()

      amplitude.track({
        eventType: 'SAVING_FIXED_DETAILS_SET',
        userId: ctx.authorized.id
      })

      ctx.body = { data: { savingPreferences: user.getSavingPreferences() } }
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
