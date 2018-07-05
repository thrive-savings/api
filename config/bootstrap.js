module.exports = (User, config, mixpanel, request, scheduler) => async () => {
  const FETCH_FREQUENCIES = ['ONCEWEEKLY', 'TWICEWEEKLY', 'BIWEEKLY', 'ONCEMONTHLY', 'ONCEDAILY']
  // const FETCH_FREQUENCIES = ['ONCEDAILY', 'EVERYMINUTE']

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

  const fetchAccounts = async frequencyWord => {
    const users = await User.findAll({ where: { fetchFrequency: frequencyWord } })
    const runTime = new Date()
    mixpanel.track(`${frequencyWord} Scheduler Running`, { Frequency: `${frequencyWord}`, UserCount: `${users.length}` })
    if (users.length > 0) {
      for (const user of users) {
        mixpanel.track(`${frequencyWord} Looping User`, { Frequency: `${frequencyWord}`, UserID: `${user.id}` })
        if (user.bankLinked) {
          mixpanel.track(`${frequencyWord} Fetching Transactions`, { Frequency: `${frequencyWord}`, UserID: `${user.id}`, LoginID: `${user.loginID}` })
          // Fetch new transactions for user
          const { data: { balance } } = await request.post({
            uri: `${config.constants.URL}/admin/transactions-fetch-user`,
            body: { secret: process.env.apiSecret, data: { userID: user.id } },
            json: true
          })

          mixpanel.track(`${frequencyWord} Getting Amount`, { Frequency: `${frequencyWord}`, UserID: `${user.id}`, SavingType: `${user.savingType}`, Balance: `${balance}` })
          // Get  saving amount
          let amount
          if (user.savingType === 'Thrive Flex') {
            const algoResult = await request.post({
              uri: `${config.constants.URL}/admin/algo-run`,
              body: { secret: process.env.apiSecret, data: { userID: user.id } },
              json: true
            })
            amount = algoResult.amount
            mixpanel.track(`${frequencyWord} Algo Returned`, { Frequency: `${frequencyWord}`, UserID: `${user.id}`, SavingType: `${user.savingType}`, Amount: `${amount}` })
          } else {
            amount = user.fixedContribution
            mixpanel.track(`${frequencyWord} Setting Fixed Amount`, { Frequency: `${frequencyWord}`, UserID: `${user.id}`, SavingType: `${user.savingType}`, Amount: `${amount}` })
          }

          mixpanel.track(`${frequencyWord} Transfering Amount ${amount}`, { Frequency: `${frequencyWord}`, UserID: `${user.id}`, SavingType: `${user.savingType}`, Amount: `${amount}`, Balance: `${balance}` })
          // Transfer the amount
          if (balance > 15000 && amount < 100000) {
            // Create queue entry
            await request.post({
              uri: `${config.constants.URL}/admin/queue-create`,
              body: { secret: process.env.apiSecret, data: { userID: user.id, amountInCents: amount, type: 'debit', requestMethod: 'Automated' } },
              json: true
            })

            // Deposit to VersaPay
            await request.post({
              uri: `${config.constants.URL}/admin/versapay-sync`,
              body: { secret: process.env.apiSecret, data: { userID: user.id } },
              json: true
            })
          }
        }
      }
    }
  }

  // Schedule jobs
  FETCH_FREQUENCIES.map(async frequencyWord => {
    const frequency = convertFrequency(frequencyWord)
    scheduler.scheduleJob(frequency, async () => {
      await fetchAccounts(frequencyWord)
    })
  })
}
