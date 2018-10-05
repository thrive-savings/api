module.exports = (request, Sentry) => async () => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({ dsn: process.env.sentryDsn })
    await request.post({
      uri: process.env.slackWebhookURL,
      body: { text: 'API restarted' },
      json: true
    })
  }
}
