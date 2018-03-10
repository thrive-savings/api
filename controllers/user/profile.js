module.exports = (fs, moment, User) => ({
  schema: [
    ['data', true, [
      ['isTOSAccepted', 'boolean'], ['isPPAccepted', 'boolean'], ['signature'],
      ['address'], ['unit'], ['city'], ['province'], ['country'], ['postalCode']
    ]]
  ],
  async method (ctx) {
    const { data } = ctx.request.body
    let body = {}

    if (data.signature) {
      data.acceptedAt = moment().toISOString()

      const match = data.signature.match(/^data:([A-Za-z-+/]+);base64,(.+)$/)

      if (match && match[2]) {
        const dir = `${process.cwd()}/assets/signatures`
        if (!fs.existsSync(dir)) fs.mkdirSync(dir)
        fs.writeFileSync(`${dir}/${ctx.authorized.id}.png`, match[2], 'base64')
      }

      body = { data: { authorized: { didSign: true } } }
    }

    await User.update(data, { where: { id: ctx.authorized.id } })

    ctx.body = body
  }
})
