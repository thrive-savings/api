module.exports = (Sequelize, bcrypt, JWT) => ({
  attributes: {
    email: {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: Sequelize.STRING
    },
    firstName: {
      type: Sequelize.STRING,
      field: 'first_name'
    },
    lastName: {
      type: Sequelize.STRING,
      field: 'last_name'
    },
    companyID: {
      type: Sequelize.INTEGER,
      allowNull: false,
      field: 'company_id',
      references: {
        model: 'companies',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    createdAt: {
      type: Sequelize.DATE,
      field: 'created_at'
    }
  },
  associations: {
    belongsTo: 'Company'
  },
  instanceMethods: {
    hashPassword (password) {
      this.password = bcrypt.hashSync(password, 8)
    },
    checkPassword (password) {
      return bcrypt.compareSync(password, this.password)
    },
    generateJWT () {
      return JWT.sign({ id: this.id, email: this.email }, process.env.key)
    },
    getData () {
      return {
        id: this.id,
        jwt: this.generateJWT(),
        email: this.email,
        phone: this.phone,
        firstName: this.firstName,
        lastName: this.lastName,
        companyID: this.companyID
      }
    }
  },
  hooks: {
    beforeCreate (instance) {
      instance.hashPassword(instance.password)
    }
  },
  indexes: [{ fields: ['code', 'company_id'] }],
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false
})
