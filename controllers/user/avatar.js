module.exports = (path, fs, User, aws) => ({
  create: {
    schema: [['data', true, [['encodedImage', true], ['imageType', true]]]],
    async method (ctx) {
      const { data: { encodedImage, imageType } } = ctx.request.body
      const avatarS3Key = `avatars/${ctx.authorized.id.toString()}`

      const s3 = new aws.S3({
        accessKeyId: process.env.awsAccessKeyID,
        secretAccessKey: process.env.awsSecretKey,
        region: process.env.awsRegion
      })

      let buf = Buffer.from(encodedImage, 'base64')
      var data = {
        Bucket: process.env.awsBucketName,
        Key: avatarS3Key,
        Body: buf,
        ContentEncoding: 'base64',
        ContentType: imageType
      }

      await s3.putObject(data).promise()
      await User.update({ avatar: avatarS3Key }, { where: { id: ctx.authorized.id } })

      const user = await User.findOne({ where: { id: ctx.authorized.id } })
      const avatar = await user.getAvatar()
      ctx.body = { avatar }
    }
  },
  delete: {
    async method (ctx) {
      const s3 = new aws.S3({
        accessKeyId: process.env.awsAccessKeyID,
        secretAccessKey: process.env.awsSecretKey,
        region: process.env.awsRegion
      })

      const user = await User.findOne({ where: { id: ctx.authorized.id } })
      await s3.deleteObject({
        Bucket: process.env.awsBucketName,
        Key: user.avatar
      }).promise()
      await User.update({ avatar: null }, { where: { id: ctx.authorized.id } })

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
