module.exports = (User) => ({
  async method (ctx) {
    const lookupphone = ctx.request.body.phone
    if (lookupphone) {
      const user = await User.findOne({ where: { phone: lookupphone } })
      if (user) {
        ctx.response.body = { data: { user_id: user.id, first_name: user.firstName, last_name: user.lastName, email: user.email, balance: user.balance, is_active: user.isActive } }
      } else {
        ctx.response.status = 204
        ctx.response.message = 'User not found'
      }
    }
  }
})
