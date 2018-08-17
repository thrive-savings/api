module.exports = request => async () => {
  if (process.env.NODE_ENV === 'production') {
    await request.post({
      uri: process.env.slackWebhookURL,
      body: { text: 'API bootstrapped' },
      json: true
    })
  }
}
