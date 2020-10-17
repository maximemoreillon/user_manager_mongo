// Importing modules
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const dotenv = require('dotenv')

// Parse .env file
dotenv.config()

let APP_PORT = process.env.APP_PORT || 80

// Instanciate an express server
const app = express()

// Use CORS and the JSON body parser
app.use(cors())
app.use(bodyParser.json())

// Use the router
app.use('/', require('./routers/home.js'))
app.use('/users', require('./routers/users.js'))

// Start listening on APP_PORT
app.listen(APP_PORT, () => {
  console.log(`[Express] User manager listening on *:${APP_PORT}`);
})
