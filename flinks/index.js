// customerID 5794ad14-9e68-4c60-a500-9ab19be6781a
const request = require('request-promise')

const main = async () => {
  const { RequestId } = await request.post({
    uri: 'https://thrive-api.flinks.io/v3/5794ad14-9e68-4c60-a500-9ab19be6781a/BankingServices/Authorize',
    body: { LoginId: '717a210a-0697-4e79-cb69-08d4ce4a4427' },
    json: true
  })
  let { Accounts: [{ Transactions: transactions = [] } = {}] = [] } = await request.post({
    uri: 'https://thrive-api.flinks.io/v3/5794ad14-9e68-4c60-a500-9ab19be6781a/BankingServices/GetAccountsDetail',
    body: {
      AccountsFilter: ['0df61bdb-008d-4f09-7579-08d4ce4a8eac'],
      MostRecentCached: true,
      RequestId,
      WithAccountIdentity: true,
      WithTransactions: true
    },
    json: true
  })
  transactions = transactions.map((
    {
      Balance: balance,
      Code: code,
      Credit: credit,
      Date: date,
      Debit: debit,
      Description: description,
      Id: token
    }
  ) => (
    {
      amount: parseInt((credit || debit) * 100),
      balance: parseInt(balance * 100),
      code,
      date,
      description,
      token,
      type: credit ? 'credit' : debit ? 'debit' : null
    }
  ))
  console.log(JSON.stringify(transactions))
  // const detail = await request.post({
  //   uri: 'https://thrive-api.flinks.io/v3/5794ad14-9e68-4c60-a500-9ab19be6781a/BankingServices/GetAccountsSummary',
  //   body: { MostRecentCached: true, RequestId },
  //   json: true
  // })
  // console.log(JSON.stringify(detail))
}

main().catch((error) => {
  if (error.stack) console.log(error.stack)
  console.log(JSON.stringify(error.error))
})
