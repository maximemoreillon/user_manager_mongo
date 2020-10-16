const bcrypt = require('bcrypt')
const dotenv = require('dotenv')
const mongodb = require('../mongodb.js')

dotenv.config()


let hash_password = (password_plain) => {
  return new Promise ( (resolve, reject) => {
    bcrypt.hash(password_plain, 10, (error, password_hashed) => {
      if(error) return reject({code: 500, message: error})
      resolve(password_hashed)
      console.log(`[Bcrypt] Password hashed`)
    })
  })
}

let db_connection = () => {
  // Might not be used
  return new Promise ( (resolve, reject) => {
    mongodb.MongoClient.connect( mongodb.url, mongodb.options, (err, db) => {
      if (err) return reject({code: 500, message: `Error conecting to the database`})
      resolve(db)
    })
  })
}

let insert_user = (user) => {
  return new Promise ( (resolve, reject) => {

    db_connection()
    .then( db => {

      db.db(mongodb.db)
      .collection(mongodb.collection)
      .insertOne(user, (error, result) => {

        db.close()

        if (error) return reject({code: 500, message: `Error inserting user in the database`})

        resolve(result)

        console.log(`[MongoDB] User ${user.username} added to the database`)

      })
    })
    .catch( error => { reject(error) } )
  })
}

let find_user = (identifier) => {
  return new Promise ( (resolve, reject) => {

    db_connection()
    .then( db => {

      // prepare the query
      const query = { $or: [
        { username: identifier },
        { email_address: identifier },
        { email: identifier },
        { _id: identifier },
      ]}

      db.db(mongodb.db)
      .collection(mongodb.collection)
      .findOne(query, (error, user) => {

        db.close()

        if (error) return reject({code: 500, message: `Error querying user in the database`})

        resolve(user)

      })
    })
    .catch( error => { reject(error) } )
  })
}

let delete_user = (user_id) => {
  return new Promise ( (resolve, reject) => {

    db_connection()
    .then( db => {

      // prepare the query
      const query = { _id: user_id }

      db.db(mongodb.db)
      .collection(mongodb.collection)
      .deleteOne(query, (error, result) => {

        db.close()

        if (error) return reject({code: 500, message: `Error deleting user from the database`})

        resolve('OK')

        console.log(`[MongoDB] User ${user_id} deleted from the database`)

      })
    })
    .catch( error => { reject(error) } )
  })
}

let get_user_id = (req) => {

  return new Promise ( (resolve, reject) => {
    let user_id = req.params.user_id

    if(!user_id) return reject({code:400, message: `Missing user ID`})

    try { resolve( mongodb.ObjectID(user_id) ) }
    catch (e) { return reject({code:400, message: `Invalid ID`}) }
  })

}

exports.get_users = (req, res) => {

  db_connection()
  .then( db => {

    db.db(mongodb.db)
    .collection(mongodb.collection)
    .find({})
    .limit(0)
    .toArray((error, users) => {

      // Close the connection to the DB
      db.close()

      // Handle DB errors
      if (error) {
        console.log(error)
        res.status(500).send(`Error retrieving users`)
        return
      }

      res.send(users)

    })

  })
  .catch( error => {
    console.log(error)
    res.status(500).send(`Error connecting to the database`)
  } )

}

exports.create_user = (req, res) => {

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
    // Using throw might not be the best way
    if(user) throw 'User already exists'
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
  .then( result => { res.send('OK') })
  .catch(error => {
    console.log(error.message || error)
    res.status(error.code || 500).send(error.message || error)
  })

}

exports.get_user = (req, res) => {

  get_user_id(req)
  .then( user_id => { return find_user(user_id) } )
  .then( user => {
    if(!user) throw 'User not found'
    res.send(user)
  } )
  .catch( error => {
    console.log(error.message || error)
    res.status(error.code || 500).send(error.message || error)
  })

}

exports.delete_user = (req, res) => {

  get_user_id(req)
  .then( user_id => { return delete_user(user_id) } )
  .then( result => { res.send(result) } )
  .catch( error => {
    console.log(error.message || error)
    res.status(error.code || 500).send(error.message || error)
  })

}

exports.replace_user = (req, res) => {
  res.send('Not implemented')
}

exports.update_user = (req, res) => {
  res.send('Not implemented')
}





// Administrator acccount creation
let create_admin = () => {

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
  .catch(error => { console.log(`[MongoDB] ${error.message || error}`) })

}

create_admin()
