module.exports = (User, mail) => ({
  async method (ctx) {
    const {
      data: { userID }
    } = ctx.request.body

    const user = await User.findOne({ where: { id: userID } })

    mail.send(
      {
        from: 'restore@thrivesavings.com',
        subject: 'Thrive Relink Email',
        to: user.email
      },
      'relink'
    )

    ctx.body = {}
  }
})
