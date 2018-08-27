'use strict';

//
// Example: node seed.js MONGO_USER MONGO_PASSWORD mongodb nrts-prod
//

var Promise         = require('es6-promise').Promise;
var _               = require('lodash');
var request         = require('request');
var fs              = require('fs');
var _applications   = [];
var _commentPeriods = [];
var _organizations  = [];
var _decisions      = [];
var _comments       = [];
var username        = '';
var password        = '';
var protocol        = 'http';
var host            = 'localhost';
var port            = '3000'
var uri             = '';

var args = process.argv.slice(2);
if (args.length !== 5) {
  console.log('');
  console.log('Please specify proper parameters: <username> <password> <protocol> <host> <port>');
  console.log('');
  console.log('eg: node seed.js admin admin http localhost 3000');
  return;
} else {
  username    = args[0];
  password    = args[1];
  protocol    = args[2];
  host        = args[3];
  port        = args[4];
  uri         = protocol + '://' + host + ':' + port + '/'; 
  console.log('Using connection:', uri);
}
// return;
// JWT Login
var jwt_login = null;
var login = function (username, password) {
  return new Promise (function (resolve, reject) {
    var body = JSON.stringify({
        username: username,
        password: password
      });
    request.post({
        url: uri + 'api/login/token',
        headers: {
          'Content-Type': 'application/json'
        },
        body: body
      }, function (err, res, body) {
        if (err || res.statusCode !== 200) {
          // console.log("err:", err, res);
          reject(null);
        } else {
          var data = JSON.parse(body);
          // console.log("jwt:", data);
          jwt_login = data.accessToken;
          resolve(data.accessToken);
        }
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

var getAllApplications = function (route) {
    return new Promise(function (resolve, reject) {
        console.log("calling:", uri + route + '?fields=tantalisID');
        request({
            url: uri + route + '?fields=tantalisID', headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + jwt_login
            }
        }, function (err, res, body) {
            if (err) {
                console.log("ERR:", err);
                reject(err);
            } else if (res.statusCode !== 200) {
                console.log("res.statusCode:", res.statusCode);
                reject(res.statusCode + ' ' + body);
            } else {
                var obj = {};
                try {
                    obj = JSON.parse(body);
                    console.log("obj:", obj);
                    resolve(obj);
                } catch (e) {
                    console.log("e:", e);
                }
            }
        });
    });
}

var getAndSaveFeatures = function (item) {
        // console.log("tantalisID:", item.tantalisID);
        // console.log("applicationID:", item._id);

        // Get the shapes from BCGW for this DISPOSITION and save them into the feature collection
        var searchURL = "https://openmaps.gov.bc.ca/geo/pub/WHSE_TANTALIS.TA_CROWN_TENURES_SVW/ows?service=wfs&version=2.0.0&request=getfeature&typename=PUB:WHSE_TANTALIS.TA_CROWN_TENURES_SVW&outputFormat=json&srsName=EPSG:4326&CQL_FILTER=DISPOSITION_TRANSACTION_SID=";
        // console.log("SEARCHING:", searchURL + "'" + item.tantalisID + "'");
        return new Promise(function (resolve, reject) {
            request({ url: searchURL + "'" + item.tantalisID + "'" }, function (err, res, body) {
                if (err) {
                    reject(err);
                } else if (res.statusCode !== 200) {
                    reject(res.statusCode + ' ' + body);
                } else {
                    var obj = {};
                    try {
                        // console.log('BCGW Call Complete.', body);
                        obj = JSON.parse(body);

                        // Store the features in the DB
                        var allFeaturesForDisp = [];
                        _.each(obj.features, function (f) {
                            // Tags default NOT public - force the application publish step before enabling these
                            // to show up on the public map.
                            f.tags = [['sysadmin']];
                            allFeaturesForDisp.push(f);
                        });

                        Promise.resolve()
                            .then(function () {
                                return allFeaturesForDisp.reduce(function (previousItem, currentItem) {
                                    return previousItem.then(function () {
                                        return doFeatureSave(currentItem, item._id);
                                    });
                                }, Promise.resolve());
                            }).then(function () {
                                // All done with promises in the array, return to the caller.
                                resolve(item);
                            });
                    } catch (e) {
                        defaultLog.error('Parsing Failed.', e);
                        resolve(item);
                    }
                }
            });
        });
};

var doFeatureSave = function (item, appId) {
    return new Promise(function (resolve, reject) {
        item.applicationID = appId;
        // console.log("uri:", uri + 'api/feature');
        // console.log("SAVING:", item);
        request.post({
            url: uri + 'api/feature',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + jwt_login
            },
            body: JSON.stringify(item)
          }, function (err, res, body) {
            if (err || res.statusCode !== 200) {
              // console.log("err:", err, res);
              reject(null);
            } else {
              var data = JSON.parse(body);
            //   console.log("SAVED:", data);
              resolve(data);
            }
        });
    });
  };

console.log("Logging in and getting JWT.");
login(username, password)
.then(function () {
  console.log("Getting applications");
  return getAllApplications('api/application');
})
.then(function (apps) {
    console.log("apps:", apps.length);
    // Now iterate through each application, grabbing the tantalisID and populating the shapes in the feature collection.
    return new Promise(function (resolve, reject) {
        Promise.resolve ()
        .then (function () {
          return apps.reduce (function (current, item) {
            return current.then (function () {
                console.log("x");
              return getAndSaveFeatures(item);
            });
          }, Promise.resolve());
        }).then(resolve, reject);
      });
})
.catch(function (err) {
  console.log("ERR:", err);
});
