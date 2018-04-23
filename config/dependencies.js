const bcrypt = require('bcryptjs')
const JWT = require('jsonwebtoken')
const request = require('request-promise')
const scheduler = require('node-schedule')
const Twilio = require('twilio')
const uuid = require('uuid/v4')
const Mixpanel = require('mixpanel')
const aws = require('aws-sdk')

const twilio = new Twilio(process.env.twilioSID, process.env.twilioToken)
const mixpanel = Mixpanel.init(process.env.mixpanelToken)

module.exports = { bcrypt, JWT, request, scheduler, twilio, uuid, mixpanel, aws }
