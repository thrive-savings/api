module.exports = (Sequelize, Account, User, mixpanel, Bluebird, request, scheduler, Transaction) => async () => {
  const FETCH_FREQUENCIES = ['ONCEWEEKLY', 'ONCEDAILY']

  const convertFrequency = frequency => {
    switch (frequency) {
      case 'ONCEWEEKLY':
        return '0 0 10 ? * 1'
      case 'TWICEWEEKLY':
        return '0 0 10 ? * 1,2'
      case 'BIWEEKLY':
        return ['0 0 10 ? 1/1 1#1', '0 0 10 ? 1/1 1#3']
      case 'ONCEMONTHLY':
        return '0 0 10 1 1/1 ?'
      case 'ONCEDAILY':
        return '0 0 10 ? * 1-5'
      case 'EVERYHOUR':
        return '0 0 0/1 1/1 * ?'
      default:
        return '0 0 10 ? * 1'
    }
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

    if (frequency.constructor === Array) {
      for (const freq of frequency) {
        scheduler.scheduleJob(freq, async () => {
          await fetchAccounts(frequencyWord)
        })
      }
    } else {
      scheduler.scheduleJob(frequency, async () => {
        await fetchAccounts(frequencyWord)
      })
    }
  })
}
