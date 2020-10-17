# User Manager (MongoDB version)

## API
| Route | Method | query/body | Description |
| --- | --- | --- | --- |
| /users | GET | limit | Get the list of users |
| /users | POST | user properties | Creates a user. Mandatory properties are username (or email_address) and password |
| /users/{user_id} | GET | - | Get the user with the given user ID |
| /users/{user_id} | DELETE | - | Delete user with the given user ID |
| /users/{user_id} | PATCH | new user properties | Update user with the given user ID |


## Environment variables
| Variable  | Description |
| --- | --- |
| MONGODB_URL | The URL of the MongoDB database |
| MONGODB_DB | The name of the MongoDB database |
| MONGODB_COLLECTION | The name of the MongoDB collection |
| DEFAULT_ADMIN_PASSWORD | The default password for the administrator account, defaults to 'admin' |
| AUTHENTICATION_API_URL | The URL of the authentication API |
