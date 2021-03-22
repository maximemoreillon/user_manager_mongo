const express = require('express')
const pjson = require('../package.json')
const dotenv = require('dotenv')
const auth = require('@moreillon/authentication_middleware')

const user_controller = require('../controllers/users.js')

// Parse .env file
dotenv.config()

let router = express.Router()

// middleware that is specific to this router
router.use(auth.authenticate)

// Could be turned into a users router
router.route('/')
  .get(user_controller.get_users)
  .post(user_controller.create_user)

router.route('/count')
  .get(user_controller.get_user_count)

router.route('/:user_id')
  .get(user_controller.get_user)
  .patch(user_controller.update_user)
  .delete(user_controller.delete_user)

router.route('/:user_id/password')
  .put(user_controller.update_password)
  .patch(user_controller.update_password)



module.exports = router
