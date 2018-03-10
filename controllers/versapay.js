const request = require('request-promise')

module.exports = (User, Account, Queue) => ({
  sync: {
    async method (ctx){	
      const queue = await Queue.findAll({where: {processed: false}})

      queue.forEach(async (queue) => {
        const {type, amount, user_id, account_id, transactionReference, uuid} = queue
        const user = await User.findOne({where: {id: user_id}})

        if(type === "credit" && user.balance < amount) {
          queue.processed = true
          queue.processedDate = Date.now()
          await queue.save()
          user.notifyUserAboutTransaction(type, "invalid_amount", amount)
        }
        else {
          let body = {
            amount_in_cents: amount,
            transaction_type: `direct_${type}`,
            transaction_reference: transactionReference,
            unique_reference: uuid,          
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
            fund_token: process.env.versaPayFundToken
          }

          let account;
          if(account_id) {
            account = await Account.findOne({where: {id: account_id}})
          }
          else {
            account = await Account.findOne({where: {user_id: user_id, is_default: true}})
            queue.account_id = account.id
            await queue.save()
          }
          
          if(account.versapay_token) {
            if(type === "debit") body.from_fund_token = account.versapay_token
            else body.to_fund_token = account.versapay_token
          } 
          else {          
            body.institution_number = account.institution
            body.branch_number = account.transit 
            body.account_number = account.number
          } 

          const response = await request.post({
            uri: `${process.env.versaPayApiURL}/api/transactions`,
            auth: {
              user: process.env.versaPayToken,
              pass: process.env.versaPayKey
            },
            body,
            json: true
          })        
        }
      })

      ctx.body = { 
        data: { 
          queue: queue.map(
            ({ id, amount, created_at, type, request_method, user_id }) => ({ id, amount, created_at, type, request_method, user_id })
          ) 
        }
      }
    }
  },
  hook: {
    async method (ctx){
      const req = ctx.request.body
      if(req.type === "transaction") {
        const {token, state, transaction_type, transaction_reference, unique_reference, amount_in_cents} = req
        const queue = await Queue.findOne({where: {uuid: unique_reference}})
        if(queue) {
          if(!queue.processed) queue.processed = true
          if(!queue.processedDate) queue.processedDate = Date.now()
          if(!queue.versapay_token) queue.versapay_token = token
          queue.state = state
          const savedQueue = await queue.save()
          
          const accountToken = transaction_type === "direct_debit" ? req.from_fund_token : req.to_fund_token
          const account = await Account.findOne({where: {id: savedQueue.account_id}}) 
          if(account.versapay_token !== accountToken) {
            account.versapay_token = accountToken
            await account.save()    
          }

          if(state === "in_progress" || state === "completed") {
            const user = await User.findOne({where: {id: savedQueue.user_id}})

            if(state === "completed") {
              const deltaAmount = transaction_type === "direct_debit" ? parseInt(amount_in_cents) : -1 * parseInt(amount_in_cents)
              user.balance = parseInt(user.balance) + deltaAmount
              await user.save()
            }

            user.notifyUserAboutTransaction(transaction_type, state, amount_in_cents)            
          }
        }
      }

      ctx.body = { data: { message: 'Success' } }
    }
  },
  updateQueues: {
    async method(ctx) {
      const queues = await Queue.findAll({where: {processed: false}})
      queues.forEach(async queue => {
        queue.setUUID()
        await queue.save()
      })

      ctx.body = { data: { message: 'Success' } }
    }
  },
  uploadQueues: {
    async method(ctx) {
      const queuesArr = ctx.request.body
      queuesArr.forEach(async ({name, type, amount, accountID, userID, transactionRef})=>{        
        const amountInCents = parseFloat(amount) * 100
        const requestMethod = "ManualQueueUpload"
        const queue = await Queue.create({ 
          userID: userID, 
          account_id: accountID, 
          amount: amountInCents, 
          type: type, 
          requestMethod: requestMethod, 
          transactionReference: transactionRef
        })
      })
      ctx.body = { data: { message: 'All Requests Successfully Queued' } }
    }
  }
})