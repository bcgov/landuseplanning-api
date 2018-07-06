## NRTS PRC API (master)

Minimal api for prc, stateless JWT & public API for NRTS-PRC

## How to run this
 
Start the server by running `npm start`

Check the swagger-ui on `http://localhost:3000/docs`

5) POST `http://localhost:3000/api/login/token` with the following body
``
{
"username": "username",
"password": "password"
}
``

 and take the token that you get in the response
 
 6) GET `http://localhost:3000/api/application` again with the following header
 ``Authorization: Bearer _TOKEN_``, replacing `_TOKEN_ ` with the value you got from request #4
