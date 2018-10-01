module.exports = (request, Sentry) => async () => {
  Sentry.init({ dsn: process.env.sentryDsn })

  if (process.env.NODE_ENV === 'production') {
    await request.post({
      uri: process.env.slackWebhookURL,
      body: { text: 'API restarted' },
      json: true
    })
  }
}
