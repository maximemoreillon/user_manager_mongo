const express = require('express')
const pjson = require('../package.json')
const dotenv = require('dotenv')

const user_controller = require('../controllers/users.js')

// Parse .env file
dotenv.config()

let router = express.Router()


// middleware that is specific to this router
router.use( (req, res, next) => {
  next()
})

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

// Could be turned into a users router
router.route('/users')
  .get(user_controller.get_users)
  .post(user_controller.create_user)

router.route('/users/:user_id')
  .get(user_controller.get_user)
  .put(user_controller.replace_user)
  .patch(user_controller.update_user)
  .delete(user_controller.delete_user)





module.exports = router
