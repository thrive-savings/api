module.exports = (User, request) => ({
  deleteCards: {
    schema: [['data', true, [['loginIds', true, 'array']]]],
    async method (ctx) {
      const { data: { loginIds } } = ctx.request.body

      let deletedIdCount = 0

      for (let loginID of loginIds) {
        loginID = loginID.toLowerCase()
        const user = await User.findOne({ where: { loginID } })
        if (!user) {
          deletedIdCount += 1
          await request.delete({
            uri: `${process.env.flinksURL}/DeleteCard/${loginID}`,
            json: true
          })
        }
      }

      ctx.body = `Successfully deleted ${deletedIdCount} of ${loginIds.length} given cards from Flinks`
    }
  }
})
