module.exports = (Sequelize, Company, CompanyAdmin, User, Queue, Bluebird) => ({
  signIn: {
    schema: [['data', true, [['email', true], ['password', true]]]],
    async method (ctx) {
      const {
        data: { email, password }
      } = ctx.request.body

      const admin = await CompanyAdmin.findOne({ email })
      if (!admin) {
        return Bluebird.reject([
          {
            key: 'email',
            value:
              'This email is not registered. Please double check for typos or sign up for an account.'
          }
        ])
      }
      if (!admin.checkPassword(password)) {
        return Bluebird.reject([
          {
            key: 'password',
            value:
              'You provided an incorrect password. Please again or reset your password.'
          }
        ])
      }

      ctx.body = { data: admin.getData() }
    }
  },
  signUp: {
    schema: [
      [
        'data',
        true,
        [
          ['code', true],
          ['email', true],
          ['firstName', true],
          ['lastName', true],
          ['password', true]
        ]
      ]
    ],
    async method (ctx) {
      const {
        data: { code, email, firstName, lastName, password }
      } = ctx.request.body

      const company = await Company.findOne({
        where: { code: code.toLowerCase().trim() }
      })
      if (!company) {
        return Bluebird.reject([
          {
            key: 'Company',
            value: `No company found for the provided code ${code}`
          }
        ])
      }

      const admin = await CompanyAdmin.create({
        companyID: company.id,
        email,
        firstName,
        lastName,
        password
      })

      ctx.body = { data: admin.getData() }
    },
    onError (error) {
      console.log(error)
      if (error instanceof Sequelize.UniqueConstraintError) {
        const fields = Object.keys(error.fields)
        if (fields.includes('email')) {
          return [{ key: 'email', value: 'This email is already taken.' }]
        }
      }
    }
  }
})
