/**
 * Fetches all ACRFD applications that may have reach a retired state, and unpublishes any found.
 *
 * Fetches all Tantalis applications that have had an update within the last day.
 * For each Tantalis application, attempts to find a matching ACRFD application.
 * If one exists, updates the features and meta to match whatever is in Tantalis (the source of truth).
 */
var Promise       = require('es6-promise').Promise;
var _             = require('lodash');
var request       = require('request');
var querystring   = require('querystring');
var moment        = require('moment');
var Utils         = require('../../api/helpers/utils');
var Actions       = require('../../api/helpers/actions');
var username      = '';
var password      = '';
var protocol      = 'http';
var host          = 'localhost';
var port          = '3000';
var uri           = '';
var client_id     = '';
var grant_type    = '';
var auth_endpoint = 'http://localhost:3000/api/login/token';
var _accessToken  = '';

var args = process.argv.slice(2);
if (args.length !== 8) {
  console.log('');
  console.log('Please specify proper parameters: <username> <password> <protocol> <host> <port> <client_id> <grant_type> <auth_endpoint>');
  console.log('');
  console.log('eg: node updateShapes.js admin admin http localhost 3000 client_id grant_type auth_endpoint');
  process.exit(1);
  return;
} else {
  username      = args[0];
  password      = args[1];
  protocol      = args[2];
  host          = args[3];
  port          = args[4];
  client_id     = args[5];
  grant_type    = args[6];
  auth_endpoint = args[7];
  uri           = protocol + '://' + host + ':' + port + '/';
  console.log('Using connection:', uri);
}

// JWT Login
var jwt_login = null; // the ACRFD login token
var jwt_expiry = null; // how long the token lasts before expiring
var jwt_login_time = null; // time we last logged in
/**
 * Logs in to ACRFD.
 *
 * @param {String} username
 * @param {String} password
 * @returns {Promise} promise that resolves with the jwt_login token.
 */
var loginToACRFD = function (username, password) {
  return new Promise(function (resolve, reject) {
    var body = querystring.stringify({
      grant_type: grant_type,
      client_id: client_id,
      username: username,
      password: password
    });
    var contentLength = body.length;
    request.post({
        url: auth_endpoint,
        headers: {
          'Content-Length': contentLength,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
      },
      function (err, res, body) {
        if (err || res.statusCode !== 200) {
          console.log(' - Login err:', err, res);
          reject(null);
        } else {
          var data = JSON.parse(body);
          jwt_login = data.access_token;
          jwt_expiry = data.expires_in;
          jwt_login_time = moment();
          resolve(data.access_token);
        }
      }
    );
  });
};

/**
 * Gets an application from ACRFD.
 *
 * @param {String} route the api route to call in the form: 'api/some/route'. (required)
 * @param {number} batchNumber the pagination page to return, starting at 0. (optional)
 * @param {number} batchSize the number of applications per page. (optional)
 * @returns {Promise} promise that resolves with an array of applications.
 */
var getApplicationByID = function (route, tantalisID) {
  return new Promise(function (resolve, reject) {
    // only update the ones that aren't deleted
    const url = uri + route + '?fields=tantalisID&isDeleted=false&tantalisId=' + tantalisID;
    request.get({
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + jwt_login
        }
      },
      function (err, res, body) {
        if (err) {
          console.log(' - getApplication err:', err);
          reject(err);
        } else if (res.statusCode !== 200) {
          console.log('res.statusCode:', res.statusCode);
          reject(res.statusCode + ' ' + body);
        } else {
          var obj = {};
          try {
            obj = JSON.parse(body);
            resolve(obj);
          } catch (e) {
            console.log(' - getApplication parse err:', e);
          }
        }
      }
    );
  });
};

/**
 * Deletes the existing application features.
 *
 * @param {Application} acrfdItem Application
 * @returns {Promise}
 */
var deleteAllApplicationFeatures = function (acrfdItem) {
  return new Promise(function (resolve, reject) {
    request.delete({
        url: uri + 'api/feature?applicationID=' + acrfdItem._id,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + jwt_login
        }
      },
      function (err, res, body) {
        if (err || res.statusCode !== 200) {
          console.log(' - deleteAllApplicationFeatures err:', err, res.body);
          reject(null);
        } else {
          var data = JSON.parse(body);
          resolve(data);
        }
      }
    );
  });
};

/**
 * Renews the jwt_login token if token expires soon.
 *
 * @returns {Promise}
 */
var renewJWTLogin = function () {
  return new Promise(function (resolve, reject) {
    var duration = moment.duration(moment().diff(jwt_login_time)).asSeconds();
    // if less than 60 seconds left before token expiry.
    if (duration > jwt_expiry - 60) {
      console.log(' - Requesting new ACRFD login token.');
      return loginToACRFD(username, password).then(function () {
        resolve();
      });
    } else {
      resolve();
    }
  });
};

/**
 * Updates and saves the application features.
 * -
 *
 * @param {String} accessToken Tantalis api token
 * @param {Application} oldApp application as it exists in ACRFD
 * @param {Application} newApp application with the latest values from Tantalis
 * @returns {Promise}
 */
var getAndSaveFeatures = function (accessToken, item) {
  return new Promise(function (resolve, reject) {
    Utils.getApplicationByDispositionID(accessToken, item.tantalisID)
      .then(function (obj) {
        // console.log("returning:", obj);
        // Store the features in the DB
        var allFeaturesForDisp = [];
        item.areaHectares = obj.areaHectares;

        var turf = require('@turf/turf');
        var helpers = require('@turf/helpers');
        var centroids = helpers.featureCollection([]);
        _.each(obj.parcels, function (f) {
          // Tags default public
          f.tags = [['sysadmin'], ['public']];
          // copy in all the app meta just to stay consistent.
          f.properties.RESPONSIBLE_BUSINESS_UNIT   = obj.RESPONSIBLE_BUSINESS_UNIT;
          f.properties.TENURE_PURPOSE              = obj.TENURE_PURPOSE;
          f.properties.TENURE_SUBPURPOSE           = obj.TENURE_SUBPURPOSE;
          f.properties.TENURE_STATUS               = obj.TENURE_STATUS;
          f.properties.TENURE_TYPE                 = obj.TENURE_TYPE;
          f.properties.TENURE_STAGE                = obj.TENURE_STAGE;
          f.properties.TENURE_SUBTYPE              = obj.TENURE_SUBTYPE;
          f.properties.TENURE_LOCATION             = obj.TENURE_LOCATION;
          f.properties.DISPOSITION_TRANSACTION_SID = obj.DISPOSITION_TRANSACTION_SID;
          f.properties.CROWN_LANDS_FILE            = obj.CROWN_LANDS_FILE;

          allFeaturesForDisp.push(f);
          // Get the polygon and put it for later centroid calculation
          centroids.features.push(turf.centroid(f));
        });
        // Centroid of all the shapes.
        if (centroids.features.length > 0) {
          item.centroid = turf.centroid(centroids).geometry.coordinates;
        }
        item.client = "";
        for (let [idx, client] of Object.entries(obj.interestedParties)) {
          if (idx > 0) {
            item.client += ", ";
          }
          if (client.interestedPartyType == 'O') {
            item.client += client.legalName;
          } else {
            item.client += client.firstName + " " + client.lastName;
          }
        }
        item.statusHistoryEffectiveDate = obj.statusHistoryEffectiveDate;

        Promise.resolve()
          .then(function () {
            return allFeaturesForDisp.reduce(function (previousItem, currentItem) {
              return previousItem.then(function () {
                return doFeatureSave(currentItem, item._id);
              });
            }, Promise.resolve());
          }).then(function () {
            resolve({ app: item, tantalisApp: obj });
          });
      });
  });
};

/**
 * Updates and saves the application features.
 *
 * @param {Application} item Application
 * @param {String} appId Application id
 * @returns {Promise}
 */
var doFeatureSave = function (item, appId) {
  return new Promise(function (resolve, reject) {
    item.applicationID = appId;
    request.post({
        url: uri + 'api/feature',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + jwt_login
        },
        body: JSON.stringify(item)
      },
      function (err, res, body) {
        if (err || res.statusCode !== 200) {
          console.log(' - doFeatureSave err:', err, res);
          reject(null);
        } else {
          var data = JSON.parse(body);
          resolve(data);
        }
      }
    );
  });
};

/**
 * Updates and saves the ACRFD application meta.
 *
 * @param {Application} acrfdItem
 * @param {Object} tantalisItem
 * @returns
 */
var updateApplicationMeta = function (acrfdItem, tantalisItem) {
  return new Promise(function (resolve, reject) {
    var updatedAppObject = {};
    updatedAppObject.businessUnit               = tantalisItem.RESPONSIBLE_BUSINESS_UNIT;
    updatedAppObject.purpose                    = tantalisItem.TENURE_PURPOSE;
    updatedAppObject.subpurpose                 = tantalisItem.TENURE_SUBPURPOSE;
    updatedAppObject.status                     = tantalisItem.TENURE_STATUS;
    updatedAppObject.type                       = tantalisItem.TENURE_TYPE;
    updatedAppObject.tenureStage                = tantalisItem.TENURE_STAGE;
    updatedAppObject.subtype                    = tantalisItem.TENURE_SUBTYPE;
    updatedAppObject.location                   = tantalisItem.TENURE_LOCATION;
    updatedAppObject.legalDescription           = tantalisItem.TENURE_LEGAL_DESCRIPTION;
    updatedAppObject.centroid                   = acrfdItem.centroid;
    updatedAppObject.areaHectares               = acrfdItem.areaHectares;
    updatedAppObject.client                     = acrfdItem.client;
    updatedAppObject.statusHistoryEffectiveDate = acrfdItem.statusHistoryEffectiveDate;

    request.put({
      url: uri + 'api/application/' + acrfdItem._id,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + jwt_login
      },
      body: JSON.stringify(updatedAppObject),
    }, function (err, res, body) {
      if (err || res.statusCode !== 200) {
        console.log(" - updateApplicationMeta err:", err, res);
        reject(null);
      } else {
        var data = JSON.parse(body);
        resolve(data);
      }
    });
  });
};

var retiredStatuses = ['ABANDONED', 'CANCELLED', 'OFFER NOT ACCEPTED', 'OFFER RESCINDED', 'RETURNED', 'REVERTED', 'SOLD',
  'SUSPENDED', 'WITHDRAWN', 'ACTIVE', 'COMPLETED', 'DISPOSITION IN GOOD STANDING', 'EXPIRED', 'HISTORIC', 'DISALLOWED'];

/**
 * Fetches all ACRFD applications that have a retired status AND a statusHistoryEffectiveDate within the last week 6 months ago.
 *
 * @returns {Promise} promise that resolves with the list of retired applications.
 */
var getApplicationsToUnpublish = function () {
  console.log(' - fetching retired applications.')
  return new Promise(function (resolve, reject) {
    var sinceDate = moment().subtract(6, 'months').subtract(1, 'week');
    var untilDate = moment().subtract(6, 'months');

    // get all applications that are in a retired status, and that have a last status update date within in the past week 6 months ago.
    var queryString = `?statusHistoryEffectiveDate[since]=${sinceDate.toISOString()}&statusHistoryEffectiveDate[until]=${untilDate.toISOString()}`
    retiredStatuses.forEach((status) => queryString += `&status[eq]=${encodeURIComponent(status)}`);

    request.get({
      url: uri + 'api/application' + queryString,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + jwt_login
      }
    },
      function (err, res, body) {
        if (err || res.statusCode !== 200) {
          console.log(' - getApplicationsToUnpublish err:', err, res);
          reject(null);
        } else {
          var data = JSON.parse(body);

          // only return applications that are currently published
          var appsToUnpublish = _.filter(data, app => {
            return Actions.isPublished(app);
          });
          resolve(appsToUnpublish);
        }
      }
    );
  });
}

/**
 * Unpublishes ACRFD applications.
 *
 * @param {*} applicationsToUnpublish array of applications
 * @returns {Promise}
 */
var unpublishApplications = function (applicationsToUnpublish) {
  console.log(` - found ${applicationsToUnpublish.length} retired applications.`)
  return applicationsToUnpublish.reduce(function (previousApp, currentApp) {
    return previousApp.then(function () {
      return new Promise(function (resolve, reject) {
        request.put({
          url: uri + 'api/application/' + currentApp._id + '/unpublish',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + jwt_login
          },
          body: JSON.stringify(currentApp)
        },
          function (err, res, body) {
            if (err || res.statusCode !== 200) {
              console.log(' - unpublishApplications err:', err, body);
              reject(null);
            } else {
              console.log(` - Unpublished application, _id: ${currentApp._id}`);
              var data = JSON.parse(body);
              resolve(data);
            }
          }
        )
      });
    });
  }, Promise.resolve());
};

/**
 *  Main call chain that utilizes the above functions to update ACRFD applications.
 */
console.log('=======================================================');
console.log('1. Authenticating with ACRFD.');
loginToACRFD(username, password)
  .then(function () {
    console.log('-----------------------------------------------');
    console.log('2. Unpublishing retired applications.')
    return getApplicationsToUnpublish()
      .then(function (appsToUnpublish) {
        return unpublishApplications(appsToUnpublish);
      });
  })
  .then(function () {
    console.log('-----------------------------------------------');
    console.log('3. Authenticating with Tantalis.');
    return Utils.loginWebADE()
      .then(function (accessToken) {
        console.log(' - TTLS API login token:', accessToken);
        _accessToken = accessToken;
        return _accessToken;
      });
  })
  .then(function () {
    console.log('-----------------------------------------------');
    console.log('4. Fetching all Tantalis applications that have been updated in the last day.');
    var lastDay = moment().subtract(1, 'days').format('YYYYMMDD');
    return Utils.getAllApplicationIDs(_accessToken, { updated: lastDay });
  })
  .then(function (recentlyUpdatedApplicationIDs) {
    console.log(` - Found ${recentlyUpdatedApplicationIDs.length} recently updated Tantalis Applications.`);
    // For each recently updated application from Tantalis, fetch the matching record in ACRFD, if it exists, and update it
    return recentlyUpdatedApplicationIDs.reduce(function (previousItem, currentItem) {
      return previousItem.then(function () {
        // Each iteration, check if the ACRFD login token needs to be re-fetched
        return renewJWTLogin()
          .then(function () {
            console.log('-----------------------------------------------');
            console.log(`5. Attempting to find matching ACRFD Application, tantalisID: ${currentItem}`);
            return getApplicationByID('api/application', currentItem);
          })
          .then(function (matchingACRFDApplications) {
            // Only expecting 1 result, but the API returns an array
            return matchingACRFDApplications.reduce(function (previousApp, currentApp) {
              return previousApp.then(function () {
                console.log('-----------------------------------------------');
                console.log(`6. Matching ACRFD Application found`);
                console.log(" - Deleting existing application features");
                return deleteAllApplicationFeatures(currentApp)
                  .then(function () {
                    console.log(" - Updating new application features");
                    return getAndSaveFeatures(_accessToken, currentApp);
                  })
                  .then(function ({ app, tantalisApp }) {
                    if (app && tantalisApp) {
                      console.log(" - Updating new application meta");
                      return updateApplicationMeta(app, tantalisApp);
                    } else {
                      console.log(" - No features found - not updating.");
                      return Promise.resolve();
                    }
                  })
              });
            }, Promise.resolve());
          });
      });
    }, Promise.resolve());
  })
  .then(function () {
    console.log('-----------------------------------------------');
    console.log('Done!');
    console.log('=======================================================');
  })
  .catch(function (err) {
    console.log('-----------------------------------------------');
    console.log(' - General err:', err);
    console.log('=======================================================');
    process.exit(1);
  });