module.exports = (fs, path, User) => ({
  create: {
    schema: [['data', true, [['image', true]]]],
    async method (ctx) {
      const { data: { image } } = ctx.request.body

      // let avatar = image
      // const matches = image.match(/^data:([A-Za-z-+/]+);base64,(.+)$/)

      // if (matches && matches[2]) {
      //   avatar = `avatars/${ctx.authorized.id}.jpg`
      //   fs.writeFileSync(`${process.cwd()}/assets/${avatar}`, matches[2], 'base64')
      // }

      await User.update({ avatar: image }, { where: { id: ctx.authorized.id } })

      ctx.body = {}
    }
  },
  defaults: {
    async method (ctx) {
      const dir = path.join(process.cwd(), 'assets/avatars/default')
      const defaults = fs.readdirSync(dir).map((item) => `avatars/default/${item}`)

      ctx.body = { data: { avatarCreate: { defaults } } }
    }
  }
})
