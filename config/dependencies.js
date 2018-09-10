const bcrypt = require('bcryptjs')
const JWT = require('jsonwebtoken')
const request = require('request-promise')
const scheduler = require('node-schedule')
const Twilio = require('twilio')
const uuid = require('uuid/v4')
const Amplitude = require('amplitude')
const aws = require('aws-sdk')
const emoji = require('node-emoji')

const twilio = new Twilio(process.env.twilioSID, process.env.twilioToken)
const amplitude = new Amplitude(process.env.amplitudeToken)

module.exports = {
  bcrypt,
  JWT,
  request,
  scheduler,
  twilio,
  uuid,
  amplitude,
  aws,
  emoji
}
