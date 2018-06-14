module.exports = (User) => ({
  async method (ctx) {
    const users = await User.findAll()

    ctx.body = { data: { users: users.map(({ id, phone, firstName, middleName, lastName, isActive }) => ({ id, phone, firstName, middleName, lastName, isActive })) } }
  }
})
