module.exports = (User, mixpanel) => ({
  setWorkType: {
    schema: [
      ['data', true, [['workType', true]]]
    ],
    async method (ctx) {
      const { data: { workType } } = ctx.request.body

      await User.update({ workType }, { where: { id: ctx.authorized.id } })

      ctx.body = { data: { workType } }
    }
  },
  setSavingType: {
    schema: [
      ['data', true, [['savingType', true]]]
    ],
    async method (ctx) {
      const { data: { savingType } } = ctx.request.body

      await User.update({ savingType }, { where: { id: ctx.authorized.id } })

      ctx.body = { data: { savingType } }
    }
  },
  setSavingDetails: {
    schema: [
      ['data', true, [['fixedContribution', true], ['frequency', true]]]
    ],
    async method (ctx) {
      const { data: { fixedContribution, frequency } } = ctx.request.body

      await User.update({ fixedContribution, fetchFrequency: frequency }, { where: { id: ctx.authorized.id } })

      ctx.body = { data: { fixedContribution, frequency } }
    }
  },
  initialSetDone: {
    async method (ctx) {
      await User.update({ savingPreferencesSet: true }, { where: { id: ctx.authorized.id } })

      ctx.body = {}
    }
  }
})
