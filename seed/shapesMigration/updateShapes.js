//
// Example: node updateShapes.js admin admin https nrts-prc-dev.pathfinder.gov.bc.ca 443
//
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
var login = function(username, password) {
  return new Promise(function(resolve, reject) {
    var body = querystring.stringify({
      grant_type: grant_type,
      client_id: client_id,
      username: username,
      password: password
    });
    var contentLength = body.length;
    request.post(
      {
        url: auth_endpoint,
        headers: {
          'Content-Length': contentLength,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
      },
      function(err, res, body) {
        if (err || res.statusCode !== 200) {
          console.log(' - login err:', err, res);
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
var getApplicationByID = function(route, tantalisID) {
  return new Promise(function(resolve, reject) {
    // only update the ones that aren't deleted
    const url = uri + route + '?fields=tantalisID&isDeleted=false&tantalisId=' + tantalisID;
    request(
      {
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + jwt_login
        }
      },
      function(err, res, body) {
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
 * @param {Application} item Application
 * @returns {Promise}
 */
var deleteAllApplicationFeatures = function(item) {
  return new Promise(function(resolve, reject) {
    request.delete(
      {
        url: uri + 'api/feature?applicationID=' + item._id,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + jwt_login
        }
      },
      function(err, res, body) {
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
      return login(username, password).then(function () {
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
var doFeatureSave = function(item, appId) {
  return new Promise(function(resolve, reject) {
    item.applicationID = appId;
    request.post(
      {
        url: uri + 'api/feature',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + jwt_login
        },
        body: JSON.stringify(item)
      },
      function(err, res, body) {
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
 * Updates and saves the application meta.
 *
 * @param {Application} app Application
 * @returns {Promise}
 */
var updateApplicationMeta = function (item, tantalisItem) {
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
    updatedAppObject.centroid                   = item.centroid;
    updatedAppObject.areaHectares               = item.areaHectares;
    updatedAppObject.client                     = item.client;
    updatedAppObject.statusHistoryEffectiveDate = item.statusHistoryEffectiveDate;

    request.put({
      url: uri + 'api/application/' + item._id,
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

/**
 * Returns whether or not the application is retired or not (statusHistoryEffectiveDate older than 6 months).
 *
 * @param {Application} app
 * @returns {Boolean} True if the application is retired, false otherwise.
 */
var isRetired = function(app) {
  if (app.status) {
    // check if retired status
    let isRetiredStatus = false;
    switch (app.status.toUpperCase()) {
      case 'ABANDONED':
      case 'CANCELLED':
      case 'OFFER NOT ACCEPTED':
      case 'OFFER RESCINDED':
      case 'RETURNED':
      case 'REVERTED':
      case 'SOLD':
      case 'SUSPENDED':
      case 'WITHDRAWN':
        isRetiredStatus = true; // ABANDONED
        break;

      case 'ACTIVE':
      case 'COMPLETED':
      case 'DISPOSITION IN GOOD STANDING':
      case 'EXPIRED':
      case 'HISTORIC':
        isRetiredStatus = true; // APPROVED
        break;

      case 'DISALLOWED':
        isRetiredStatus = true; // NOT APPROVED
        break;
    }

    if (isRetiredStatus) {
      // check if retired more than 6 months ago
      return moment(app.statusHistoryEffectiveDate).endOf('day').add(6, 'months').isBefore();
    }
  }

  return false;
};

/**
 * Unpublishes the application.
 *
 * @param {APplication} app
 * @returns {Promise}
 */
var unpublishApplication = function (app) {
  return new Promise(function (resolve, reject) {
    request.put({
      url: uri + 'api/application/' + app._id + '/unpublish',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + jwt_login
      },
      body: JSON.stringify(app)
    },
      function (err, res, body) {
        if (err || res.statusCode !== 200) {
          console.log(' - unpublishApplication err:', err, res);
          reject(null);
        } else {
          var data = JSON.parse(body);
          resolve(data);
        }
      }
    );
  });
};

console.log('=======================================================');
console.log('1. Authenticating with ACRFD.');
/**
 *  Main call chain that utilizes the above functions to update ACRFD applications.
 */
// Authenticate to ACRFD and get jwt token
login(username, password)
  .then(function () {
    // Authenticate to Tantalis and get access token used by #getAndSaveFeatures
    console.log('2. Authenticating with Tantalis.');
    return Utils.loginWebADE().then(function (accessToken) {
      console.log(' - TTLS API login token:', accessToken);
      _accessToken = accessToken;
      return _accessToken;
    });
  })
  .then(function () {
    console.log('3. Fetching all Tantalis applications that have been updated in the last day.');
    // Get applications from Tantalis that have been updated in the last day
    var lastDay = moment().subtract(1, 'days').format('YYYYMMDD');
    return Utils.getAllApplicationIDs(_accessToken, { updated: lastDay });
  })
  .then(function (recentlyUpdatedApplicationIDs) {
    console.log(` - Found ${recentlyUpdatedApplicationIDs.length} recently updated Tantalis Applications.`);
    // For each application from Tantalis, fetch the matching record in ACRFD if it exists and update it
    return recentlyUpdatedApplicationIDs.reduce(function (previousItem, currentItem) {
      return previousItem.then(function () {
        console.log('-----------------------------------------------');
        // Each iteration, check if the login token needs to be re-fetched
        return renewJWTLogin()
          .then(function () {
            console.log(`4. Attempting to find matching ACRFD Application, tantalisID: ${currentItem}`);
            // Attempt to fetch the ACRFD application, which may not exist
            return getApplicationByID('api/application', currentItem);
          })
          .then(function (apps) {
            // We really only expect 1 result, but the API returns an array
            return apps.reduce(function (previousItem, currentItem) {
              return previousItem.then(function () {
                console.log(`5. Matching ACRFD Application found`);
                console.log(" - Deleting existing application features");
                // First delete all the application features.  We blindly overwrite.
                return deleteAllApplicationFeatures(currentItem)
                  .then(function () {
                    console.log(" - Updating new application features");
                    // Fetch and store the features in the feature collection for this application.
                    return getAndSaveFeatures(_accessToken, currentItem);
                  })
                  .then(function ({ app, tantalisApp }) {
                    if (app && tantalisApp) {
                      console.log(" - Updating new application meta");
                      // Update the application meta.
                      return updateApplicationMeta(app, tantalisApp);
                    } else {
                      console.log(" - No features found - not updating.");
                      // No features.on't update meta.
                      return Promise.resolve();
                    }
                  })
                  .then(function (app) {
                    // If application is retired then unpublish it.
                    if (app && isRetired(app) && Actions.isPublished(app)) {
                      console.log(" - Application is now retired - UNPUBLISHING.");
                      return unpublishApplication(app);
                    } else {
                      return Promise.resolve();
                    }
                  });
              });
            }, Promise.resolve());
          });
      });
    },
      Promise.resolve());
  })
  .then(function () {
    console.log('-----------------------------------------------');
    console.log('Done!');
    console.log('=======================================================');
  })
  .catch(function (err) {
    console.log(' - general err:', err);
    process.exit(1);
  });