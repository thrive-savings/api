module.exports = (Sequelize, Account, User, mixpanel, Bluebird, request, scheduler, Transaction) => async () => {
  const FETCH_FREQUENCIES = ['ONCEWEEKLY', 'TWICEWEEKLY', 'BIWEEKLY', 'ONCEMONTHLY', 'EVERYHOUR']

  const convertFrequency = frequency => {
    const rule = new scheduler.RecurrenceRule()
    rule.hour = 10
    rule.minute = 0
    switch (frequency) {
      case 'ONCEWEEKLY':
        rule.dayOfWeek = 0
        break
      case 'TWICEWEEKLY':
        rule.dayOfWeek = [1, 3]
        break
      case 'BIWEEKLY':
        rule.date = [0, 15]
        break
      case 'ONCEMONTHLY':
        rule.date = 0
        break
      case 'ONCEDAILY':
        break
      case 'EVERYHOUR':
        rule.hour = null
        break
      default: // ONCEWEEKLY
        rule.dayOfWeek = 0
        break
    }
    return rule
  }

  const fetchAccounts = async frequencyWord => {
    const users = await User.findAll({where: {fetchFrequency: frequencyWord}})
    const runTime = new Date()
    mixpanel.track('Scheduler Running', { Date: `${runTime}`, Frequency: `${frequencyWord}`, UserCount: `${users.length}` })
    console.log(`Scheduler Running for Frequency ${frequencyWord} at ${runTime}`)
    // if (users.length <= 0) return
  }

  // Schedule jobs
  FETCH_FREQUENCIES.map(async frequencyWord => {
    const frequency = convertFrequency(frequencyWord)
    scheduler.scheduleJob(frequency, async () => {
      await fetchAccounts(frequencyWord)
    })
  })
}
