module.exports = (config, request, scheduler) => async () => {
  // const FETCH_FREQUENCIES = ['ONCEWEEKLY', 'TWICEWEEKLY', 'BIWEEKLY', 'ONCEMONTHLY', 'ONCEDAILY']
  const FETCH_FREQUENCIES = []

  const convertFrequency = frequency => {
    const rule = new scheduler.RecurrenceRule()
    rule.tz = 'UTC'
    rule.hour = 10
    rule.minute = 0
    switch (frequency) {
      case 'ONCEWEEKLY':
        rule.dayOfWeek = 1
        break
      case 'TWICEWEEKLY':
        rule.dayOfWeek = [1, 3]
        break
      case 'BIWEEKLY':
        rule.date = [1, 15]
        break
      case 'ONCEMONTHLY':
        rule.date = 1
        break
      case 'ONCEDAILY':
        break
      case 'EVERYHOUR':
        rule.hour = null
        break
      case 'EVERYMINUTE':
        rule.hour = null
        rule.minute = new scheduler.Range(0, 59, 1)
        break
      default: // ONCEWEEKLY
        rule.dayOfWeek = 1
        break
    }
    return rule
  }

  // Schedule jobs
  FETCH_FREQUENCIES.map(async frequencyWord => {
    const frequency = convertFrequency(frequencyWord)
    scheduler.scheduleJob(frequency, async () => {
      await request.post({
        uri: `${config.constants.URL}/admin/worker-run`,
        body: { secret: process.env.apiSecret, data: { frequencyWord } },
        json: true
      })
    })
  })
}
