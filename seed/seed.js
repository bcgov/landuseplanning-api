'use strict';

var MongoClient = require('mongodb').MongoClient;
var Promise = require('promise');
var _ = require('lodash');

var defaultConnectionString = 'mongodb://localhost:27017/nrts-dev';
var url = '';

var args = process.argv.slice(2);
if (args.length !== 4) {
  console.log('Using default localhost connection:', defaultConnectionString);
  url = defaultConnectionString;
} else {
  var username = args[0];
  var password = args[1];
  var host = args[2];
  var db = args[3];
  url = 'mongodb://' + username + ':' + password + '@' + host + ':27017/' + db;
}

var find = function (collectionName, query, fields) {
  return new Promise(function (resolve, reject) {
    MongoClient.connect(url, function (err, db) {

      var collection = db.collection(collectionName);

      collection.find(query, fields).toArray(function (err, entries) {
        if (err) reject(err);
        db.close();
        resolve(entries);
      });

    });
  });
};

var findOne = function (collectionName, query) {
  return new Promise(function (resolve, reject) {
    MongoClient.connect(url, function (err, db) {

      var collection = db.collection(collectionName);

      collection.findOne(query, function (err, entries) {
        if (err) reject(err);
        db.close();
        resolve(entries);
      });

    });
  });
};

var insertAll = function (collectionName, entries) {
  return new Promise(function (resolve, reject) {
    MongoClient.connect(url, function (err, db) {

      var collection = db.collection(collectionName);

      collection.insertMany(entries, {}, function (err, result) {
        db.close();
        if (err) {
          reject(err);
        } else {
          console.log('inserted ' + result.insertedCount + ' entry(ies) into ' + collectionName);
          resolve(result);
        }
      });

    });
  });
};

var update = function (collectionName, query, entry) {
  return new Promise(function (resolve, reject) {
    MongoClient.connect(url, function (err, db) {

      var collection = db.collection(collectionName);

      collection.updateOne(query, { $set: entry }, {}, function (err, result) {
        db.close();
        if (err) {
          reject(err);
        } else {
          console.log('updated entry in ' + collectionName);
          resolve(result);
        }
      });

    });
  });
};

var updateAll = function (collectionName, entries) {
  if (_.isEmpty(entries)) {
    return Promise.resolve();
  }
  var updates = _.map(entries, function (entry) {
    return update(collectionName, { _id: entry._id }, entry);
  });
  return Promise.all(updates);
};

var run = function () {
  return new Promise(function (resolve, reject) {

    console.log('start');
    Promise.resolve()
      .then(function () {
        // require('./loadOrgs')();
        var orglist = require('./orglist.json');
        return insertAll('organizations', orglist);
      })
      .then(function () {
        // require('./loadApps')();
        var applist = require('./applist.json');
        return insertAll('applications', applist);
      })
      .then(function () {
        // require('./loadDocs')();
        var doclist = require('./doclist.json');
        return insertAll('documents', doclist);
      })
      .then(function () {
        console.log('end');
        resolve(':)');
      }, function (err) {
        console.log('ERROR: end');
        console.log('ERROR: end err =', JSON.stringify(err));
        reject(err);
      });

  });
};

run().then(function (success) {
  console.log('success', success);
  process.exit();
}).catch(function (error) {
  console.error('error', error);
  process.exit();
});
