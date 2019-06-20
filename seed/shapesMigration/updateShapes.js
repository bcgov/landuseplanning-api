//
// Example: node updateShapes.js admin admin https eagle-dev.pathfinder.gov.bc.ca 443
//
var Promise         = require('es6-promise').Promise;
var _               = require('lodash');
var request         = require('request');
var querystring     = require('querystring');
var Utils           = require('../../api/helpers/utils');
var username        = '';
var password        = '';
var protocol        = 'http';
var host            = 'localhost';
var port            = '3000';
var uri             = '';
var client_id       = '';
var grant_type      = '';
var auth_endpoint   = 'http://localhost:3000/api/login/token';
var _accessToken    = '';

var args = process.argv.slice(2);
console.log('=======================================================');
if (args.length !== 8) {
  console.log(
    'Please specify proper parameters: <username> <password> <protocol> <host> <port> <client_id> <grant_type> <auth_endpoint>'
  );
  console.log('Example: node updateShapes.js admin admin http localhost 3000 client_id grant_type auth_endpoint');
  console.log('=======================================================');
  process.exit(1);
  return;
} else {
  username = args[0];
  password = args[1];
  protocol = args[2];
  host = args[3];
  port = args[4];
  client_id = args[5];
  grant_type = args[6];
  auth_endpoint = args[7];
  uri = protocol + '://' + host + ':' + port + '/';
  console.log('Using connection:', uri);
  console.log('-----------------------------------------------');
}

// Used when unpublishing retired applications.
var retiredStatuses = [
  'ABANDONED',
  'CANCELLED',
  'OFFER NOT ACCEPTED',
  'OFFER RESCINDED',
  'RETURNED',
  'REVERTED',
  'SOLD',
  'SUSPENDED',
  'WITHDRAWN',
  'ACTIVE',
  'COMPLETED',
  'DISPOSITION IN GOOD STANDING',
  'EXPIRED',
  'HISTORIC',
  'DISALLOWED'
];

// Used to renew the ACRFD login tokes before it expires if the update script takes longer than the lifespan of the token.
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
var loginToACRFD = function(username, password) {
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
var getApplicationByID = function(route, tantalisID) {
  return new Promise(function(resolve, reject) {
    // only update the ones that aren't deleted
    const url = uri + route + '?fields=tantalisID&isDeleted=false&tantalisId=' + tantalisID;
    request.get(
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
 * @param {Application} acrfdApp Application
 * @returns {Promise}
 */
var deleteAllApplicationFeatures = function(acrfdApp) {
  return new Promise(function(resolve, reject) {
    request.delete(
      {
        url: uri + 'api/feature?applicationID=' + acrfdApp._id,
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
var renewJWTLogin = function() {
  return new Promise(function(resolve, reject) {
    var duration = moment.duration(moment().diff(jwt_login_time)).asSeconds();
    // if less than 60 seconds left before token expiry.
    if (duration > jwt_expiry - 60) {
      console.log(' - Requesting new ACRFD login token.');
      return loginToACRFD(username, password).then(function() {
        resolve();
      });
    } else {
      resolve();
    }
  });
};

/**
 * Updates and saves the application features.
 *
 * @param {Application} acrfdApp application as it exists in ACRFD
 * @param {Application} tantalisApp application with the latest values from Tantalis
 * @returns {Promise} promise that resolves wih the updated ACRFD application
 */
var updateFeatures = function(acrfdApp, tantalisApp) {
  return new Promise(function(resolve, reject) {
    // console.log("returning:", tantalisApp);
    // Store the features in the DB
    var allFeaturesForDisp = [];
    acrfdApp.areaHectares = tantalisApp.areaHectares;

    var turf = require('@turf/turf');
    var helpers = require('@turf/helpers');
    var centroids = helpers.featureCollection([]);
    _.each(tantalisApp.parcels, function(f) {
      // Tags default public
      f.tags = [['sysadmin'], ['public']];
      // copy in all the app meta just to stay consistent.
      f.properties.RESPONSIBLE_BUSINESS_UNIT = tantalisApp.RESPONSIBLE_BUSINESS_UNIT;
      f.properties.TENURE_PURPOSE = tantalisApp.TENURE_PURPOSE;
      f.properties.TENURE_SUBPURPOSE = tantalisApp.TENURE_SUBPURPOSE;
      f.properties.TENURE_STATUS = tantalisApp.TENURE_STATUS;
      f.properties.TENURE_TYPE = tantalisApp.TENURE_TYPE;
      f.properties.TENURE_STAGE = tantalisApp.TENURE_STAGE;
      f.properties.TENURE_SUBTYPE = tantalisApp.TENURE_SUBTYPE;
      f.properties.TENURE_LOCATION = tantalisApp.TENURE_LOCATION;
      f.properties.DISPOSITION_TRANSACTION_SID = tantalisApp.DISPOSITION_TRANSACTION_SID;
      f.properties.CROWN_LANDS_FILE = tantalisApp.CROWN_LANDS_FILE;

      allFeaturesForDisp.push(f);
      // Get the polygon and put it for later centroid calculation
      centroids.features.push(turf.centroid(f));
    });
    // Centroid of all the shapes.
    if (centroids.features.length > 0) {
      acrfdApp.centroid = turf.centroid(centroids).geometry.coordinates;
    }
    acrfdApp.client = '';
    for (let [idx, client] of Object.entries(tantalisApp.interestedParties)) {
      if (idx > 0) {
        acrfdApp.client += ', ';
      }
      if (client.interestedPartyType == 'O') {
        acrfdApp.client += client.legalName;
      } else {
        acrfdApp.client += client.firstName + ' ' + client.lastName;
      }
    }
    acrfdApp.statusHistoryEffectiveDate = tantalisApp.statusHistoryEffectiveDate;

    Promise.resolve()
      .then(function() {
        return allFeaturesForDisp.reduce(function(previousFeature, currentFeature) {
          return previousFeature.then(function() {
            return saveFeatures(currentFeature, acrfdApp._id);
          });
        }, Promise.resolve());
      })
      .then(function() {
        resolve(acrfdApp);
      });
  });
};

/**
 * Saves the application features.
 *
 * @param {Application} feature Application feature
 * @param {String} acrfdAppId Application id
 * @returns {Promise}
 */
var saveFeatures = function(feature, acrfdAppId) {
  return new Promise(function(resolve, reject) {
    feature.applicationID = acrfdAppId;
    request.post(
      {
        url: uri + 'api/feature',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + jwt_login
        },
        body: JSON.stringify(feature)
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
 * Updates and saves the ACRFD application meta.
 *
 * @param {Application} acrfdApp
 * @param {Object} tantalisApp
 * @returns
 */
var updateApplicationMeta = function(acrfdApp, tantalisApp) {
  return new Promise(function(resolve, reject) {
    var updatedAppObject = {};
    updatedAppObject.businessUnit = tantalisApp.RESPONSIBLE_BUSINESS_UNIT;
    updatedAppObject.purpose = tantalisApp.TENURE_PURPOSE;
    updatedAppObject.subpurpose = tantalisApp.TENURE_SUBPURPOSE;
    updatedAppObject.status = tantalisApp.TENURE_STATUS;
    updatedAppObject.type = tantalisApp.TENURE_TYPE;
    updatedAppObject.tenureStage = tantalisApp.TENURE_STAGE;
    updatedAppObject.subtype = tantalisApp.TENURE_SUBTYPE;
    updatedAppObject.location = tantalisApp.TENURE_LOCATION;
    updatedAppObject.legalDescription = tantalisApp.TENURE_LEGAL_DESCRIPTION;
    updatedAppObject.centroid = acrfdApp.centroid;
    updatedAppObject.areaHectares = acrfdApp.areaHectares;
    updatedAppObject.client = acrfdApp.client;
    updatedAppObject.statusHistoryEffectiveDate = acrfdApp.statusHistoryEffectiveDate;

    request.put(
      {
        url: uri + 'api/application/' + acrfdApp._id,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + jwt_login
        },
        body: JSON.stringify(updatedAppObject)
      },
      function(err, res, body) {
        if (err || res.statusCode !== 200) {
          console.log(' - updateApplicationMeta err:', err, res);
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
 * Given an ACRFD applications tantalisID (disposition ID), makes all necessary calls to update it with the latest information from Tantalis.
 *
 * @param {string} applicationIDToUpdate a tantalisID
 * @returns {Promise}
 */
var updateApplication = function(applicationIDToUpdate) {
  return renewJWTLogin()
    .then(function() {
      return getApplicationByID('api/application', applicationIDToUpdate);
    })
    .then(function(applicationsToUpdate) {
      // Only expecting 1 result, but the API returns an array
      return applicationsToUpdate.reduce(function(previousApp, currentApp) {
        return previousApp.then(function() {
          console.log('-----------------------------------------------');
          console.log(`6. Updating ACRFD Application, tantalisID: ${currentApp.tantalisID}`);
          console.log(' - Fetching Tantalis application');
          return Utils.getApplicationByDispositionID(_accessToken, currentApp.tantalisID).then(function(tantalisApp) {
            if (!tantalisApp) {
              console.log(' - No Tantalis application found - not updating.');
              return Promise.resolve();
            }
            console.log(' - Deleting existing application features');
            return deleteAllApplicationFeatures(currentApp)
              .then(function() {
                console.log(' - Updating new application features');
                return updateFeatures(currentApp, tantalisApp);
              })
              .then(function(updatedApp) {
                console.log(' - Updating new application meta');
                return updateApplicationMeta(updatedApp, tantalisApp);
              });
          });
        });
      }, Promise.resolve());
    });
};

/**
 * Fetches all ACRFD applications that have a retired status AND a statusHistoryEffectiveDate within the past week 6 months ago.
 *
 * @returns {Promise} promise that resolves with the list of retired applications.
 */
var getApplicationsToUnpublish = function() {
  console.log(' - fetching retired applications.');
  return new Promise(function(resolve, reject) {
    var sinceDate = moment()
      .subtract(6, 'months')
      .subtract(1, 'week');
    var untilDate = moment().subtract(6, 'months');

    // get all applications that are in a retired status, and that have a last status update date within in the past week 6 months ago.
    var queryString = `?statusHistoryEffectiveDate[since]=${sinceDate.toISOString()}&statusHistoryEffectiveDate[until]=${untilDate.toISOString()}`;
    retiredStatuses.forEach(status => (queryString += `&status[eq]=${encodeURIComponent(status)}`));

    request.get(
      {
        url: uri + 'api/application' + queryString,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + jwt_login
        }
      },
      function(err, res, body) {
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
};

/**
 * Unpublishes ACRFD applications.
 *
 * @param {*} applicationsToUnpublish array of applications
 * @returns {Promise}
 */
var unpublishApplications = function(applicationsToUnpublish) {
  return applicationsToUnpublish.reduce(function(previousApp, currentApp) {
    return previousApp.then(function() {
      return new Promise(function(resolve, reject) {
        request.put(
          {
            url: uri + 'api/application/' + currentApp._id + '/unpublish',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + jwt_login
            },
            body: JSON.stringify(currentApp)
          },
          function(err, res, body) {
            if (err || res.statusCode !== 200) {
              console.log(' - unpublishApplications err:', err, body);
              reject(null);
            } else {
              console.log(` - Unpublished application, _id: ${currentApp._id}`);
              var data = JSON.parse(body);
              resolve(data);
            }
          }
        );
      });
    });
  }, Promise.resolve());
};

/**
 * Gets all non-deleted ACRFD application tantalis IDs.
 *
 * @returns {Promise} promise that resolves with an array of ACRFD application tantalisIDs.
 */
var getAllApplicationIDs = function() {
  return new Promise(function(resolve, reject) {
    // only update the ones that aren't deleted
    const url = uri + 'api/application/' + '?fields=tantalisID&isDeleted=false';
    request.get(
      {
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + jwt_login
        }
      },
      function(err, res, body) {
        if (err) {
          console.log(' - getAllApplicationIDs err:', err);
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
            console.log(' - getAllApplicationIDs parse err:', e);
          }
        }
      }
    );
  });
};

/**
 *  Main call chain that utilizes the above functions to update ACRFD applications.
 */
console.log('1. Authenticating with ACRFD.');
loginToACRFD(username, password)
  .then(function() {
    console.log('-----------------------------------------------');
    console.log('2. Unpublishing retired applications.');
    return getApplicationsToUnpublish().then(function(applicationsToUnpublish) {
      console.log(` - found ${applicationsToUnpublish.length} retired applications.`);
      return unpublishApplications(applicationsToUnpublish);
    });
  })
  .then(function() {
    console.log('-----------------------------------------------');
    console.log('3. Authenticating with Tantalis.');
    return Utils.loginWebADE().then(function(accessToken) {
      console.log(' - TTLS API login token:', accessToken);
      _accessToken = accessToken;
      return _accessToken;
    });
  })
  .then(function() {
    console.log('-----------------------------------------------');
    console.log('4. Fetching all Tantalis applications that have been updated in the last day.');
    var lastDay = moment()
      .subtract(1, 'days')
      .format('YYYYMMDD');
    return Utils.getAllApplicationIDs(_accessToken, { updated: lastDay });
  })
  .then(function(recentlyUpdatedApplicationIDs) {
    console.log('-----------------------------------------------');
    console.log(
      '5. Fetching all non-deleted ACRFD applications and cross referencing with recently updated Tantalis applications.'
    );
    return getAllApplicationIDs().then(function(allACRFDApplicationIDs) {
      return allACRFDApplicationIDs
        .map(app => app.tantalisID)
        .filter(tantalisID => recentlyUpdatedApplicationIDs.includes(tantalisID));
    });
  })
  .then(function(applicationIDsToUpdate) {
    console.log(
      ` - Found ${
        applicationIDsToUpdate.length
      } ACRFD Applications with matching recently updated Tantalis application.`
    );
    // For each ACRFD application with a matching recently updated application from Tantalis, fetch the matching record in ACRFD and update it
    return applicationIDsToUpdate.reduce(function(previousItem, currentItem) {
      return previousItem.then(function() {
        // Each iteration, check if the ACRFD login token needs to be re-fetched
        return updateApplication(currentItem);
      });
    }, Promise.resolve());
  })
  .then(function() {
    console.log('-----------------------------------------------');
    console.log('Done!');
    console.log('=======================================================');
  })
  .catch(function(err) {
    console.log('-----------------------------------------------');
    console.log(' - General err:', err);
    console.log('=======================================================');
    process.exit(1);
  });
