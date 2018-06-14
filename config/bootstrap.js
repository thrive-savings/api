module.exports = (Sequelize, User, Account, Transaction, config, mixpanel, Bluebird, request, scheduler) => async () => {
  // const FETCH_FREQUENCIES = ['ONCEWEEKLY', 'TWICEWEEKLY', 'BIWEEKLY', 'ONCEMONTHLY', 'EVERYHOUR', 'EVERYMINUTE']
  const FETCH_FREQUENCIES = ['ONCEDAILY']

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
      case 'EVERYMINUTE':
        rule.hour = null
        rule.minute = new scheduler.Range(0, 59, 1)
        break
      default: // ONCEWEEKLY
        rule.dayOfWeek = 0
        break
    }
    return rule
  }

  const fetchAccounts = async frequencyWord => {
    const users = await User.findAll({ where: { fetchFrequency: frequencyWord } })
    const runTime = new Date()
    mixpanel.track('Scheduler Running', { Date: `${runTime}`, Frequency: `${frequencyWord}`, UserCount: `${users.length}` })
    console.log(`Scheduler Running for Frequency ${frequencyWord} at ${runTime}`)
    if (users.length > 0) {
      for (const user of users) {
        // Fetch new transactions for user
        console.log(`Fetching Transactions for userID: ${user.id}`)
        const { data: { balance } } = await request.post({
          uri: `${config.constants.URL}/admin/transactions-fetch-user`,
          body: { secret: process.env.apiSecret, data: { userID: user.id } },
          json: true
        })
        console.log(balance)

        // Get amount
        let amount
        if (user.savingType === 'Thrive Flex') {
          console.log(`Calling Algo to get the saving amount for userID: ${user.id}`)
          const algoResult = await request.post({
            uri: `${config.constants.URL}/admin/algo-run`,
            body: { secret: process.env.apiSecret, data: { userID: user.id } },
            json: true
          })
          console.log(algoResult)
          amount = algoResult.amount
        } else {
          amount = user.fixedContribution
        }

        // Transfer to Versapay
        if (balance > 15000 && amount < 100000) {
          console.log(`Creating queue row for UserID: ${user.id}, amount: ${amount}`)
          const queueCreateResult = await request.post({
            uri: `${config.constants.URL}/admin/queue-create`,
            body: { secret: process.env.apiSecret, data: { userID: user.id, amountInCents: amount, type: 'debit', requestMethod: 'Automated' } },
            json: true
          })
          console.log(queueCreateResult)

          console.log(`Calling Versapay Sync with userID: ${user.id}, amount: ${amount}`)
          const versapaySyncResult = await request.post({
            uri: `${config.constants.URL}/admin/versapay-sync`,
            body: { secret: process.env.apiSecret, data: { userID: user.id } },
            json: true
          })
          console.log(versapaySyncResult)
        }
      }
    }
  }

  // Schedule jobs
  FETCH_FREQUENCIES.map(async frequencyWord => {
    const frequency = convertFrequency(frequencyWord)
    scheduler.scheduleJob(frequency, async () => {
      console.log(`Running job for ${frequencyWord}`)
      await fetchAccounts(frequencyWord)
    })
  })
}
