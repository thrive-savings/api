const koaStatic = require('koa-static')
const { serve } = require('api-boilerplate')

const port = process.env.port || 3000

const run = async () => {
  const { app, routes, server } = await serve()
  console.log('Routes:')
  Object.keys(routes).forEach(item => {
    console.log(`${item}: ${routes[item]}`)
  })
  app.use(koaStatic('assets'))
  server.listen(port)
}

run().catch(error => {
  if (error.stack) console.log(error.stack)
  else console.log(error)
})

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason)
})
