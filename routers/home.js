const express = require('express')
const pjson = require('../package.json')
const dotenv = require('dotenv')

// Parse .env file
dotenv.config()

let router = express.Router()

router.get('/', (req, res) => {
  res.send('User management API (MongoDB version), Maxime MOREILLON')
})

router.get('/info', (req, res) => {
  res.send({
    name: pjson.name,
    author: pjson.author,
    version: pjson.version,
  })
})


module.exports = router
