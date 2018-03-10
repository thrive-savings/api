module.exports = {
  username: process.env.dbUsername,
  password: process.env.dbPassword,
  dialect: 'postgres',
  host: process.env.dbHost,
  port: 5432,
  define: {
    underscored: true,
    timestamps: false
  },
  timezone: 'UTC'
}
