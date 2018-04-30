module.exports = (Sequelize, Account, User, mixpanel, Bluebird, request, scheduler, Transaction) => async () => {
  const FETCH_FREQUENCIES = ['ONCEWEEKLY', 'ONCEDAILY']

  const convertFrequency = frequency => {
    switch (frequency) {
      case 'ONCEWEEKLY':
        return { hour: 10, minute: 0, dayOfWeek: 1, tz: 'UTC' }
      case 'ONCEDAILY':
        return { hour: 10, minute: 0, tz: 'UTC' }
      case 'EVERYMINUTE':
        return { minute: new scheduler.Range(0, 59, 1), tz: 'UTC' }
      default:
        return { hour: 10, minute: 0, dayOfWeek: 1, tz: 'UTC' }
    }
  }

  const fetchAccounts = async frequencyWord => {
    const users = await User.findAll({where: {fetchFrequency: frequencyWord}})
    if (users.length <= 0) return

    let runTime = new Date()
    try {
      console.log(`Scheduler Running for Frequency ${frequencyWord} at ${runTime}`)
      let validatedUsers = []

      if (users.length > 1) {
        let LoginIds = []
        let UserIds = {}
        users.map(({id: userID, loginID}) => {
          UserIds[loginID] = userID
          LoginIds.push(loginID)
        })

        console.log(`Running ${process.env.flinksURL}/AuthorizeMultiple with ${LoginIds}`)
        const { ValidLoginIds, InvalidLoginIds } = await request.post({
          uri: `${process.env.flinksURL}/AuthorizeMultiple`,
          body: { LoginIds, MostRecentCached: true },
          json: true
        })
        console.log(`AuthorizeMultiple returned ${ValidLoginIds} and ${InvalidLoginIds}`)

        validatedUsers = ValidLoginIds.map(({LoginId, RequestId}) => ({UserId: UserIds[LoginId], LoginId, RequestId}))

        if (InvalidLoginIds.length > 0) {
          mixpanel.track('AuthorizeMultiple Returned Invalid Ids', { Date: `${runTime}`, LoginIds: `${InvalidLoginIds}` })
        }
      } else {
        const {id: UserId, loginID: LoginId} = users[0]

        console.log(`Running ${process.env.flinksURL}/Authorize for ${LoginId}`)
        const {RequestId} = await request.post({
          uri: `${process.env.flinksURL}/Authorize`,
          body: { LoginId, MostRecentCached: true },
          json: true
        })
        console.log(`Authorize returned ${RequestId}`)

        validatedUsers.push({UserId, LoginId, RequestId})
      }

      console.log(`ValidatedUsers Count: ${validatedUsers.length}`)
      for (let {UserId, LoginId, RequestId} of validatedUsers) {
        let getAccountsDetailsBody = {
          RequestId,
          WithAccountIdentity: true,
          WithTransactions: true
        }
        let refreshDelta = []
        const accounts = await Account.findAll({where: {userID: UserId}})
        let accountsCached = {}
        accounts.map(async account => {
          accountsCached[account.token] = account
          const lastTransaction = await Transaction.findOne({order: [['id', 'DESC']], where: {accountID: account.id}})
          if (lastTransaction) {
            refreshDelta.push({ AccountId: account.token, TransactionId: lastTransaction.token })
          }
        })
        if (refreshDelta.length > 0) getAccountsDetailsBody.RefreshDelta = refreshDelta

        console.log(`Running ${process.env.flinksURL}/GetAccountsDetail with body ${getAccountsDetailsBody}`)
        const { Accounts: foundAccounts = [] } = await request.post({
          uri: `${process.env.flinksURL}/GetAccountsDetail`,
          body: getAccountsDetailsBody,
          json: true
        })
        console.log(`GetAccountsDetail returned ${foundAccounts.length} accounts`)

        if (foundAccounts.length > 0) {
          foundAccounts.map(async foundAccount => {
            let {
              Holder: { Name: name = '' } = {},
              InstitutionNumber: institution,
              AccountNumber: number,
              Transactions: transactions = [],
              TransitNumber: transit,
              Id: accountToken
            } = foundAccount

            let storedAccount = accountsCached[accountToken]

            if (!storedAccount.transit) {
              const fullName = name

              console.log(`Updating Account in DB with ${fullName}, ${institution}, ${number}, ${transit}`)
              await Account.update({ fullName, institution, number, transit }, { where: { id: storedAccount.id } })
            }

            transactions = transactions.reverse().map(
              ({
                Balance: balance,
                Credit: credit,
                Date: date,
                Debit: debit,
                Description: description,
                Id: token
              }) => ({
                accountID: accountsCached[accountToken].id,
                amount: parseInt((credit || debit) * 100),
                balance: parseInt(balance * 100),
                date,
                description,
                token,
                type: credit ? 'credit' : debit ? 'debit' : null
              })
            )

            console.log(`Creating Transactions in DB for ${transactions}`)
            await Bluebird.all(transactions.map((item) => Transaction.create(item)))
          })
        }
      }
    } catch ({ error }) {
      let httpStatusCode = error.HttpStatusCode ? error.HttpStatusCode : 'unknown'
      let flinksCode = error.FlinksCode ? error.FlinksCode : 'unknown'
      let usersData = []
      users.map(({id: userID, loginID}) => {
        usersData.push({userID, loginID})
      })
      console.log(`Error Fetching Flinks Transactions: Date: ${runTime}, UsersData: ${JSON.stringify(usersData)}, Frequency: ${frequencyWord}, HttpCode: ${httpStatusCode}, FlinksCode: ${flinksCode}`)
      mixpanel.track('Error Fetching Flinks Transactions', { Date: `${runTime}`, UsersData: `${JSON.stringify(usersData)}`, Frequency: `${frequencyWord}`, HttpCode: `${httpStatusCode}`, FlinksCode: `${flinksCode}` })
    }
  }

  // Schedule jobs
  FETCH_FREQUENCIES.map(async frequencyWord => {
    let frequency = convertFrequency(frequencyWord)

    scheduler.scheduleJob(frequency, async () => {
      await fetchAccounts(frequencyWord)
    })
  })
}
