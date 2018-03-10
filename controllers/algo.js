module.exports = (Queue, Account, Transaction) => ({
	fetch: {
		schema: [
			['userID']
		],		
		async method (ctx){
			const { userID } = ctx.request.body
			const account = await Account.findOne({where: {user_id: userID, is_default: true}})
			let transactions = []
			let accountID = 0
			if(account) {
				accountID = account.id
				let d = new Date();
				d.setMonth(d.getMonth() - 3);
				transactions = await Transaction.findAll({where: {account_id: accountID, date: {$gte: d}}})
				transactions = transactions.map(
					({ id, amount, balance, date, description, token, type }) => ({ id, amount, balance, date, description, token, type })
				)			
			}						

      ctx.body = {
				data: { 
					transactions,
					accountID									
				}
			}
    }
	},
	upload: {
		async method(ctx) {
			const data = ctx.request.body
			data.map(async ({userID, accountID, savingAmount}) => {
				console.log(userID + " --- " + accountID + " --- " + savingAmount)
				const type = "debit"
				const requestMethod = "AlgoGenerated"				
				const queue = await Queue.create({ 
          userID: userID, 
          account_id: accountID, 
          amount: savingAmount, 
          type: type, 
          requestMethod: requestMethod
        })
			})
			
			ctx.body = {
				data: {message: "Algo Generated Requests successfully queued"}
			}
		}
	}			
})