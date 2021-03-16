const bcrypt = require('bcrypt')
const dotenv = require('dotenv')
const mongodb = require('../mongodb.js')

dotenv.config()

const error_handling = (error, res) => {
  console.log(error.message || error)
  res.status(error.code || 500).send(error.message || error)
}


const hash_password = (password_plain) => {
  return new Promise ( (resolve, reject) => {
    bcrypt.hash(password_plain, 10, (error, password_hashed) => {
      if(error) return reject({code: 500, message: error})
      resolve(password_hashed)
      console.log(`[Bcrypt] Password hashed`)
    })
  })
}


const insert_user = (user) => {
  return new Promise ( (resolve, reject) => {

    mongodb.MongoClient.connect( mongodb.url, mongodb.options)
    .then( db => {
      return db.db(mongodb.db)
      .collection(mongodb.collection)
      .insertOne(user)
    })
    .then(resolve)
    .catch(reject)
  })
}

const find_user = (identifier) => {
  return new Promise ( (resolve, reject) => {

    mongodb.MongoClient.connect( mongodb.url, mongodb.options)
    .then( db => {

      // prepare the query
      const query = { $or: [
        { username: identifier },
        { email_address: identifier },
        { email: identifier },
        { _id: identifier },
      ]}

      return db.db(mongodb.db)
      .collection(mongodb.collection)
      .findOne(query)
    })
    .then(resolve)
    .catch(reject)
  })
}

const delete_user = (user_id) => {
  return new Promise ( (resolve, reject) => {

    mongodb.MongoClient.connect( mongodb.url, mongodb.options)
    .then( db => {

      // prepare the query
      const query = { _id: user_id }

      return db.db(mongodb.db)
      .collection(mongodb.collection)
      .deleteOne(query)
    })
    .then(result => {
      resolve('OK')
      console.log(`[MongoDB] User ${user_id} deleted from the database`)
    })
    .catch(reject)
  })
}

const get_user_id = (req) => {

  return new Promise ( (resolve, reject) => {
    const user_id = req.params.user_id

    if(!user_id) return reject({code:400, message: `Missing user ID`})

    try { resolve( mongodb.ObjectID(user_id) ) }
    catch (e) { return reject({code:400, message: `Invalid ID`}) }
  })

}

const update_user = (user_id, new_user_properties, current_user) => {
  return new Promise ( (resolve, reject) => {

    // prevent users from modifying other users
    if(!current_user.admin && current_user._id !== user_id.toString() ) {
      return reject({code: 403, message: `Cannot modify another user`})
    }

    // Prevent users from modifying certain fields
    let customizable_fields = [
      'display_name',
      'password_hashed',
    ]

    // Adding customizable fields for administrators
    if(current_user.admin) {
      customizable_fields = [
        ...customizable_fields,
        'admin',
        'locked',
      ]
    }

    let unauthorized_attempts = []
    for (let [key, value] of Object.entries(new_user_properties)) {
      if(!customizable_fields.includes(key)) {
        unauthorized_attempts.push(key)
      }
    }

    if(unauthorized_attempts.length > 0) {
      return reject({code: 403, message: `The following fields cannot be modified: ${unauthorized_attempts.join(', ')}`})
    }

    mongodb.MongoClient.connect( mongodb.url, mongodb.options)
    .then( db => {

      const query = { _id: user_id }
      const action = {$set: new_user_properties}

      return db.db(mongodb.db)
      .collection(mongodb.collection)
      .updateOne(query, action)
    })
    .then(result => {
      resolve(`User ${user_id} updated`)
      console.log(`[MongoDB] User ${user_id} updated`)
    })
    .catch(reject)
  })
}

const check_password = (password_plain, user) => {
  return new Promise ( (resolve, reject) => {

    const password_hashed = user.password_hashed

    bcrypt.compare(password_plain, password_hashed, (error, password_correct) => {

      if(error) return reject({code: 500, message: error})

      if(!password_correct) return reject({code: 403, message: `Incorrect password`})

      resolve(user)

    })

  })
}

exports.get_users = (req, res) => {

  const limit = req.query.limit ?? 500

  mongodb.MongoClient.connect(mongodb.url, mongodb.options)
  .then( db => {
    return db.db(mongodb.db)
    .collection(mongodb.collection)
    .find({})
    .limit(limit)
    .toArray()
  })
  .then( (result) => { res.send(result) })
  .catch( error => { error_handling(error, res) })

}



exports.create_user = (req, res) => {

  // Could do a better job at parsing that
  const username = req.body.username
  const email_address = req.body.email_address
  const password_plain = req.body.password

  if(! (username || email_address) ) {
    let error_message = `Missing username or email_address`
    console.log(error_message)
    res.status(400).send(error_message)
    return
  }

  if(!password_plain ) {
    let error_message = `Missing password`
    console.log(error_message)
    res.status(400).send(error_message)
    return
  }

  find_user(username || email_address)
  .then( user => {
    if(user) throw {code: 400, message: 'User already exists'}
    return hash_password(password_plain)
  })
  .then( password_hashed => {

    const user = {
      username: username,
      email_address: email_address,
      password_hashed: password_hashed,
    }

    return insert_user(user)

  })
  .then( (result) => { res.send(result) })
  .catch( error => { error_handling(error, res) })

}

exports.get_user = (req, res) => {

  get_user_id(req)
  .then( user_id => { return find_user(user_id) } )
  .then( user => {
    if(!user) throw {code: 400, message: `User not found`}
    res.send(user)
  })
  .catch( error => { error_handling(error, res) })

}

exports.delete_user = (req, res) => {
  get_user_id(req)
  .then( delete_user )
  .then( (result) => { res.send(result) })
  .catch( error => { error_handling(error, res) })
}

exports.update_user = (req, res) => {

  const new_user_properties = req.body
  const current_user = res.locals.user

  get_user_id(req)
  .then( user_id => {
    return update_user(user_id, new_user_properties, current_user)
  })
  .then( (result) => { res.send(result) })
  .catch( error => { error_handling(error, res) })
}

exports.update_password = (req, res) => {

  const current_user = res.locals.user

  let target_user_id = null // made global to access in further scopes

  get_user_id(req)
  .then( user_id => {
    // Finding user in the DB

    // scope extraction
    target_user_id = user_id

    // prevent users from modifying other users
    if(!current_user.admin && current_user._id !== user_id.toString() ) {
      throw {code: 400, message: `Not allowed to modify another user`}
    }

    return find_user(user_id)

  })

  .then( user => {
    // Checking current password

    const current_password_plain = req.body.current_password

    // guard against missing current password
    if(!current_password_plain) throw {code: 400, message: `Current password not provided`}
    let password_hashed = user.password_hashed
    return check_password(current_password_plain, user)
  })
  .then( user => {
    // Hashing new password

    const new_password_plain = req.body.new_password
    const new_password_confirm = req.body.new_password_confirm

    if(!new_password_plain) throw {code: 400, message: `New password not provided`}
    if(!new_password_confirm) throw {code: 400, message: `New password confirm not provided`}
    if(new_password_confirm !== new_password_plain) {
      throw {code: 400, message: `New password confirm does not match new password`}
    }

    // Add more conditions on password here

    return hash_password(new_password_plain)
  })
  .then( password_hashed => {
    // Updating user with new password

    const new_user_properties = {password_hashed: password_hashed}
    return update_user(target_user_id, new_user_properties, current_user)
  })
  .then( (result) => { res.send(result) })
  .catch( error => { error_handling(error, res) })

}




// Administrator acccount creation
exports.create_admin = () => {

  const admin_username = 'admin'

  find_user(admin_username)
  .then( user => {
    // Using throw might not be the best way
    if(user) throw 'Admin account already exists'

    let admin_password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin'

    return hash_password(admin_password)
  })
  .then( password_hashed => {

    const user = {
      username: admin_username,
      password_hashed: password_hashed,
      admin: true,
    }

    return insert_user(user)

  })
  .then( result => { console.log(`[MongoDB] Admin account created`) })
  .catch( error => { console.log(`[MongoDB] ${error.message || error}`) })

}
