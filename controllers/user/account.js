module.exports = (Goal, User) => ({
  async method (ctx) {
    const user = await User.findOne({ include: [Goal], where: { id: ctx.authorized.id } })

    let body = {}
    if (user) {
      body = {
        data: {
          authorized: { avatar: user.get('avatar') },
          PageAccount: {
            balance: user.balance,
            goals: user.goals.map((item) => ({ description: item.description, id: item.id, image: item.get('image') }))
          }
        }
      }
    }

    ctx.body = body
  }
})
