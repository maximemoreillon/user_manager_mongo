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
  return mongodb.MongoClient.connect( mongodb.url, mongodb.options)
  .then( db => {
    return db.db(mongodb.db)
    .collection(mongodb.collection)
    .insertOne(user)
  })
}

const find_user = (identifier) => {
  return mongodb.MongoClient.connect( mongodb.url, mongodb.options)
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
}

const delete_user = (user_id) => {
  return mongodb.MongoClient.connect( mongodb.url, mongodb.options)
  .then( db => {
    const query = { _id: user_id }
    return db.db(mongodb.db)
    .collection(mongodb.collection)
    .deleteOne(query)
  })
}

const get_user_id = (req, res) => {

  return new Promise ( (resolve, reject) => {
    let user_id = req.params.user_id
    if(user_id === 'self') user_id = res.locals.user._id

    if(!user_id) return reject({code:400, message: `Missing user ID`})


    try { resolve( mongodb.ObjectID(user_id) ) }
    catch (e) { return reject({code:400, message: `Invalid ID`}) }
  })

}

const update_user = (user_id, new_user_properties, current_user) => {

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

  return mongodb.MongoClient.connect( mongodb.url, mongodb.options)
  .then( db => {

    const query = { _id: user_id }
    const action = {$set: new_user_properties}

    return db.db(mongodb.db)
    .collection(mongodb.collection)
    .updateOne(query, action)
  })

}

const check_password = (password_plain, user) => {
  return new Promise ( (resolve, reject) => {

    const {password_hashed} = user

    bcrypt.compare(password_plain, password_hashed, (error, password_correct) => {

      if(error) return reject({code: 500, message: error})

      if(!password_correct) return reject({code: 403, message: `Incorrect password`})

      resolve(user)

    })

  })
}

exports.get_users = (req, res) => {

  let limit = req.query.limit ?? 500
  limit = Number(limit)
  if(limit === -1) limit = 0
  const skip = req.query.skip ?? 0

  mongodb.MongoClient.connect(mongodb.url, mongodb.options)
  .then( db => {
    return db.db(mongodb.db)
    .collection(mongodb.collection)
    .find({})
    .skip(Number(skip))
    .limit(limit)
    .toArray()
  })
  .then( (result) => { 
    console.log(`[MongoDB] User list queried`)
    res.send(result)
   })
  .catch( error => { error_handling(error, res) })

}

exports.get_user_count = (req, res) => {

  mongodb.MongoClient.connect(mongodb.url, mongodb.options)
    .then(db => {
      return db.db(mongodb.db)
        .collection(mongodb.collection)
        .countDocuments()
    })
    .then((result) => { res.send({user_count: result}) })
    .catch(error => { error_handling(error, res) })

}



exports.create_user = (req, res) => {

  // Destructuring
  const { username, email_address, password } = req.body

  if(! (username || email_address) ) {
    let error_message = `Missing username or email_address`
    console.log(error_message)
    res.status(400).send(error_message)
    return
  }

  if(!password ) {
    let error_message = `Missing password`
    console.log(error_message)
    res.status(400).send(error_message)
    return
  }

  find_user(username || email_address)
  .then( user => {
    if(user) throw {code: 400, message: 'User already exists'}
    return hash_password(password)
  })
  .then( password_hashed => {

    const user = {
      username,
      email_address,
      password_hashed,
    }

    return insert_user(user)

  })
  .then( (result) => {
    console.log(`[MongoDB] User created`)
    res.send(result)
   })
  .catch( error => { error_handling(error, res) })

}

exports.get_user = (req, res) => {

  get_user_id(req,res)
  .then(find_user)
  .then( user => {
    if(!user) throw {code: 400, message: `User not found`}
    console.log(`[MongoDB] User queried`)
    res.send(user)
  })
  .catch( error => { error_handling(error, res) })

}

exports.delete_user = (req, res) => {
  get_user_id(req,res)
  .then( delete_user )
  .then( (result) => {
    console.log(`[MongoDB] User deleted`)
    res.send(result)
   })
  .catch( error => { error_handling(error, res) })
}

exports.update_user = (req, res) => {

  const new_user_properties = req.body
  const current_user = res.locals.user

  get_user_id(req,res)
  .then( user_id => {
    return update_user(user_id, new_user_properties, current_user)
  })
  .then( (result) => {
    console.log(`[MongoDB] User updated`)
    res.send(result)
   })
  .catch( error => { error_handling(error, res) })
}

exports.update_password = (req, res) => {

  const current_user = res.locals.user

  let target_user_id = null // made global to access in further scopes

  const { current_password, new_password, new_password_confirm  } = req.body

  if(!current_password) return res.status(400).send(`Current password not provided`)
  if(!new_password) return res.status(400).send(`New password not provided`)
  if(!new_password_confirm) return res.status(400).send(`New password confirm not provided`)
  if(new_password_confirm !== new_password) {
    return res.status(400).send(`New password confirm does not match new password`)
  }

  get_user_id(req,res)
  .then( user_id => {
    // scope extraction
    target_user_id = user_id

    // prevent users from modifying other users
    if(!current_user.admin && current_user._id !== user_id.toString() ) {
      throw {code: 400, message: `Not allowed to modify another user`}
    }

    return find_user(user_id)
  })

  .then( user => {
    const { password_hashed } = user
    return check_password(current_password, user)
  })
  .then( user => {
    // Hashing new password
    return hash_password(new_password)
  })
  .then( password_hashed => {
    // Updating user with new password
    const new_user_properties = { password_hashed }
    return update_user(target_user_id, new_user_properties, current_user)
  })
  .then( (result) => { res.send(result) })
  .catch( error => { error_handling(error, res) })

}




// Administrator acccount creation
exports.create_admin = () => {

  const admin_username = process.env.DEFAULT_ADMIN_USERNAME || 'admin'

  find_user(admin_username)
  .then( user => {
    // Using throw might not be the best way
    if(user) throw 'Admin account already exists'

    const admin_password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin'

    return hash_password(admin_password)
  })
  .then( password_hashed => {

    const user = {
      username: admin_username,
      admin: true,
      password_hashed,
    }

    return insert_user(user)

  })
  .then( result => { console.log(`[MongoDB] Admin account created`) })
  .catch( error => { console.log(`[MongoDB] ${error.message || error}`) })

}
