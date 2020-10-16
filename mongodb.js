const mongodb = require('mongodb')
const dotenv = require('dotenv')

// Parse environment variables
dotenv.config()

exports.MongoClient = mongodb.MongoClient
exports.ObjectID = mongodb.ObjectID

exports.url = process.env.MONGODB_URL || 'mongodb://mongodb:27017'
exports.db = process.env.MONGODB_DB || 'users_test'
exports.collection = process.env.MONGODB_COLLECTION || 'users'

exports.options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}
