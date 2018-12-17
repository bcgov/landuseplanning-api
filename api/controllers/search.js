var auth         = require("../helpers/auth");
var _            = require('lodash');
var defaultLog   = require('winston').loggers.get('default');
var mongoose     = require('mongoose');
var Actions      = require('../helpers/actions');
var Utils        = require('../helpers/utils');
var request      = require('request');
var _accessToken = null;

exports.protectedTTLSGetApplicationsByFileNumber = function (args, res, rest) {
  var fileNumber = args.swagger.params.fileNumber.value;
  defaultLog.info("Searching TTLS API for Crown Land FileNumber:", fileNumber);
  return new Promise(function (r, j) {
    return Utils.loginWebADE()
    .then(function (accessToken) {
      _accessToken = accessToken;
      console.log("TTLS API Logged in:", _accessToken);
      // fileNumber lookup
      return Utils.getApplicationByFilenumber(_accessToken, fileNumber);
    }).then(r, j);
  }).then(function (promises) {
    console.log("returning number of items:", promises.length);

    // Call the api again but this time grab all the related information on each app
    // returned form the CL file lookup.
    var allApps = [];
    Promise.resolve()
    .then(function () {
      return promises.reduce(function (previousItem, currentItem) {
        return previousItem.then(function () {
              // return Actions.publish(currentItem);
              console.log("executing disp:", currentItem.DISPOSITION_TRANSACTION_SID);
              return Utils.getApplicationByDispositionID(_accessToken, currentItem.DISPOSITION_TRANSACTION_SID)
              .then(function (appData) {
                allApps.push(appData);
                return appData;
              });
        });
      }, Promise.resolve());
    }).then(function () {
      // All done with promises in the array, return to the caller.
      defaultLog.info("------------------------done with promises------------------------");
      console.log(allApps);
      return Actions.sendResponse(res, 200, allApps);
    });
  }).catch(function (err) {
    console.log("Error in API:", err);
    return Actions.sendResponse(res, err.statusCode, err);
  });
};

exports.protectedTTLSGetApplicationByDisp = function (args, res, rest) {
  var dtId = args.swagger.params.dtId.value;
  defaultLog.info("Searching TTLS API for Disposition Transaction ID:", dtId);
  return new Promise(function (resolve, reject) {
    return Utils.loginWebADE()
    .then(function (accessToken) {
      _accessToken = accessToken;
      console.log("TTLS API Logged in:", _accessToken);
      // Disp lookup
      return Utils.getApplicationByDispositionID(_accessToken, dtId);
    }).then(resolve, reject);
  }).then(function (data) {
    console.log("returning:", data.DISPOSITION_TRANSACTION_SID);
    return Actions.sendResponse(res, 200, data);
  }).catch(function (err) {
    console.log("Error in API:", err);
    return Actions.sendResponse(res, err.statusCode, err);
  });
};

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
};

exports.publicGetClientsInfoByDispositionId = function (args, res, next) {
  var dtId = args.swagger.params.dtId.value;
  defaultLog.info("Searching arcgis for client info on Disposition Transaction ID:", dtId);

  var searchURL = "http://maps.gov.bc.ca/arcgis/rest/services/mpcm/bcgw/MapServer/dynamicLayer/query?layer=%7B%22id%22%3A1%2C%22source%22%3A%7B%22type%22%3A%22dataLayer%22%2C%22dataSource%22%3A%7B%22type%22%3A%22table%22%2C%22workspaceId%22%3A%22MPCM_ALL_PUB%22%2C%22dataSourceName%22%3A%22WHSE_TANTALIS.TA_INTEREST_HOLDER_VW%22%7D%7D%7D&text=&objectIds=&time=&geometry=&geometryType=esriGeometryEnvelope&inSR=&spatialRel=esriSpatialRelIntersects&relationParam=&outFields=*&returnGeometry=true&maxAllowableOffset=&outSR=&returnIdsOnly=false&returnCountOnly=false&orderByFields=&groupByFieldsForStatistics=&outStatistics=&returnZ=false&returnM=false&returnDistinctValues=false&f=json&where=DISPOSITION_TRANSACTION_SID=";
  return new Promise(function (resolve, reject) {
    request({ url: searchURL + "'" + dtId + "'" }, function (err, res, body) {
      if (err) {
        reject(err);
      } else if (res.statusCode !== 200) {
        reject(res.statusCode + ' ' + body);
      } else {
        var obj = {};
        try {
          defaultLog.info('ArcGIS Call Complete.', body);
          obj = JSON.parse(body);
        } catch (e) {
          defaultLog.error('Parsing Failed.', e);
        }
        var clients = [];
        _.each(obj.features, function (i) {
          clients.push(i.attributes);
        });
        resolve(clients);
      }
    });
  }).then(function (data) {
    return Actions.sendResponse(res, 200, data);
  }).catch(function (err) {
    defaultLog.error(err);
    return Actions.sendResponse(res, 400, err);
  });
};

// Get BCGW features by CLID
exports.publicGetBCGW = function (args, res, next) {
  // Build match query if on appId route
  // Pad with leading zeros to make CLID seven digits
  var clid = _.padStart(args.swagger.params.crownLandsId.value, 7, '0');
  defaultLog.info("Searching BCGW for CLID:", clid);

  // TODO: Error handling.

  // var searchURL = "https://openmaps.gov.bc.ca/geo/pub/WHSE_TANTALIS.TA_CROWN_TENURES_SVW/ows?service=wfs&version=2.0.0&request=getfeature&typename=pub:WHSE_TANTALIS.TA_CROWN_TENURES_SVW&outputFormat=application/json&PROPERTYNAME=CROWN_LANDS_FILE&CQL_FILTER=CROWN_LANDS_FILE=";
  var searchURL = "https://openmaps.gov.bc.ca/geo/pub/WHSE_TANTALIS.TA_CROWN_TENURES_SVW/ows?service=wfs&version=2.0.0&request=getfeature&typename=PUB:WHSE_TANTALIS.TA_CROWN_TENURES_SVW&outputFormat=json&srsName=EPSG:4326&CQL_FILTER=CROWN_LANDS_FILE=";
  return new Promise(function (resolve, reject) {
    request({ url: searchURL + "'" + clid + "'" }, function (err, res, body) {
      if (err) {
        reject(err);
      } else if (res.statusCode !== 200) {
        reject(res.statusCode + ' ' + body);
      } else {
        var obj = {};
        try {
          defaultLog.info('BCGW Call Complete.', body);
          obj = JSON.parse(body);
        } catch (e) {
          defaultLog.error('Parsing Failed.', e);
          resolve(obj);
        }

        // Search for this in our DB in case it's already been imported.
        try {
          var result = _.chain(obj.features)
            .groupBy("properties.DISPOSITION_TRANSACTION_SID")
            .toPairs()
            .map(function (currentItem) {
              return _.zipObject(["SID", "sids"], currentItem);
            })
            .value();

          obj.sidsFound = [];
          result.reduce(function (current, code) {
            return current.then(function () {
              var Application = require('mongoose').model('Application');
              return new Promise(function (complete, fail) {
                Application.findOne({ tantalisID: code.SID, isDeleted: false }, function (err, o) {
                  if (err) {
                    fail();
                  }
                  if (o) {
                    obj.sidsFound.push(code.SID); // NB: SID is string (tantalisID is number)
                  } else {
                    console.log("Nothing found");
                  }
                  complete();
                });
              });
            });
          }, Promise.resolve())
            .then(function () {
              resolve(obj);
            });
        } catch (e) {
          // Error, don't tag the isImported on it.
          resolve(obj);
        }
      }
    });
  }).then(function (data) {
    return Actions.sendResponse(res, 200, data);
  }).catch(function (err) {
    defaultLog.error(err);
    return Actions.sendResponse(res, 400, err);
  });
};

// Get local shapes
exports.publicGetDispositionTransactionId = function (args, res, next) {
  return new Promise(function (resolve, reject) {
    var Feature = require('mongoose').model('Feature');

    var query = {};
    if (args.swagger.params.dtId && args.swagger.params.dtId.value !== undefined) {
      _.assignIn(query, { 'properties.DISPOSITION_TRANSACTION_SID': args.swagger.params.dtId.value });
    }

    return Feature.find(query, function (err, data) {
      if (err) {
        return Actions.sendResponse(res, 400, err);
      } else {
        var featureCollection = {};
        featureCollection.crs = {};
        featureCollection.crs.properties = {};
        featureCollection.crs.properties.name = "urn:ogc:def:crs:EPSG::4326";
        featureCollection.totalFeatures = data.length;
        featureCollection.features = data;
        featureCollection.type = "FeatureCollection";
        return Actions.sendResponse(res, 200, featureCollection);
      }
    });
  });
};

// Get BCGW features by DTID
exports.publicGetBCGWDispositionTransactionId = function (args, res, next) {
  // Build match query if on dtId route
  var dtId = args.swagger.params.dtId.value;
  defaultLog.info("Searching BCGW for DTID:", dtId);

  // TODO: Error handling.

  var searchURL = "https://openmaps.gov.bc.ca/geo/pub/WHSE_TANTALIS.TA_CROWN_TENURES_SVW/ows?service=wfs&version=2.0.0&request=getfeature&typename=PUB:WHSE_TANTALIS.TA_CROWN_TENURES_SVW&outputFormat=json&srsName=EPSG:4326&CQL_FILTER=DISPOSITION_TRANSACTION_SID=";
  return new Promise(function (resolve, reject) {
    request({ url: searchURL + "'" + dtId + "'" }, function (err, res, body) {
      if (err) {
        reject(err);
      } else if (res.statusCode !== 200) {
        reject(res.statusCode + ' ' + body);
      } else {
        var obj = {};
        try {
          defaultLog.info('BCGW Call Complete.', body);
          obj = JSON.parse(body);
        } catch (e) {
          defaultLog.error('Parsing Failed.', e);
          resolve(obj);
        }

        // Search for this in our DB in case it's already been imported.
        try {
          var result = _.chain(obj.features)
            .groupBy("properties.DISPOSITION_TRANSACTION_SID")
            .toPairs()
            .map(function (currentItem) {
              return _.zipObject(["SID", "sids"], currentItem);
            })
            .value();

          obj.sidsFound = [];
          result.reduce(function (current, code) {
            return current.then(function () {
              var Application = require('mongoose').model('Application');
              return new Promise(function (complete, fail) {
                Application.findOne({ tantalisID: code.SID, isDeleted: false }, function (err, o) {
                  if (err) {
                    fail();
                  }
                  if (o) {
                    obj.sidsFound.push(code.SID); // NB: SID is string (tantalisID is number)
                  } else {
                    console.log("Nothing found");
                  }
                  complete();
                });
              });
            });
          }, Promise.resolve())
            .then(function () {
              resolve(obj);
            });
        } catch (e) {
          // Error, don't tag the isImported on it.
          resolve(obj);
        }
      }
    });
  }).then(function (data) {
    return Actions.sendResponse(res, 200, data);
  }).catch(function (err) {
    defaultLog.error(err);
    return Actions.sendResponse(res, 400, err);
  });
};
