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
      ['data', true, [['fixedContribution', true], ['frequency', true]]]
    ],
    async method (ctx) {
      const {
        data: { fixedContribution, frequency }
      } = ctx.request.body

      await User.update(
        { fixedContribution, fetchFrequency: frequency },
        { where: { id: ctx.authorized.id } }
      )

      amplitude.track({
        eventType: 'SAVING_FIXED_DETAILS_SET',
        userId: ctx.authorized.id
      })

      ctx.body = { data: { fixedContribution, frequency } }
    }
  },
  initialSetDone: {
    async method (ctx) {
      const onboardingStep = 'SavingGoals'
      await User.update(
        { savingPreferencesSet: true, onboardingStep },
        { where: { id: ctx.authorized.id } }
      )

      amplitude.identify({
        userId: ctx.authorized.id,
        userProperties: {
          'Saving Preferences Set': true
        }
      })

      ctx.body = { data: { onboardingStep } }
    }
  }
})
