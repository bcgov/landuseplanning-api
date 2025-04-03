//
// Example: node addUsers.js username password http localhost 3000
//
var Promise = require('es6-promise').Promise;
var request = require('request');
var fs = require('fs');
var csv = require('fast-csv');
var username = '';
var password = '';
var protocol = 'http';
var host = 'localhost';
var port = '3000';
var uri = '';
var filename = 'example.csv';
var users = [];

var args = process.argv.slice(2);
if (args.length !== 6) {
  console.log('');
  console.log('Please specify proper parameters: <username> <password> <protocol> <host> <port> <filename>');
  console.log('');
  console.log('eg: node addUsers.js admin admin http locahost 3000 filename.csv');
  return;
} else {
  username = args[0];
  password = args[1];
  protocol = args[2];
  host = args[3];
  port = args[4];
  filename = args[5];
  uri = protocol + '://' + host + ':' + port + '/';
  console.log('Using connection:', uri);
}

var processUsers = function(users) {
  return new Promise(function(resolve, reject) {
    Promise.resolve().then(function() {
      return users.reduce(function(previousItem, currentItem) {
        return previousItem.then(function() {
          return addUser(currentItem);
        });
      }, Promise.resolve());
    });
  });
};

// JWT Login
var jwt_login = null;
var login = function(username, password) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify({
      username: username,
      password: password
    });
    request.post(
      {
        url: uri + 'api/login/token',
        headers: {
          'Content-Type': 'application/json'
        },
        body: body
      },
      function(err, res, body) {
        if (err || res.statusCode !== 200) {
          console.log('err:', err, res);
          reject(null);
        } else {
          var data = JSON.parse(body);
          jwt_login = data.accessToken;
          resolve(data.accessToken);
        }
      }
    );
  });
};

var addUser = function(item) {
  return new Promise(function(resolve, reject) {
    var userObj = {
      username: item[0],
      password: item[1],
      displayName: item[2],
      firstName: item[3],
      lastName: item[4],
      email: item[5]
    };
    console.log('userObj:', userObj);
    request.post(
      {
        url: uri + 'api/user',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + jwt_login
        },
        body: JSON.stringify(userObj)
      },
      function(err, res, body) {
        if (err || res.statusCode !== 200) {
          console.log('err:', err, res);
          reject(null);
        } else {
          var data = JSON.parse(body);
          resolve(data);
        }
      }
    );
  });
};

console.log('Logging in and getting JWT.');
login(username, password)
  .then(function() {
    console.log('Reading CSV');
    var stream = fs.createReadStream(filename);
    var csvStream = csv()
      .on('data', function(data) {
        // Skip header
        if (data[0] !== 'USER NAME') {
          users.push(data);
        }
      })
      .on('end', function() {
        console.log('adding users:', users.length);
        return processUsers(users).then(function() {
          console.log('Adding Users Complete.');
        });
      });

    stream.pipe(csvStream);
  })
  .catch(function(err) {
    console.log('ERR:', err);
  });
