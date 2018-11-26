//
// Example: node updateShapes.js admin admin https nrts-prc-dev.pathfinder.gov.bc.ca 443
//
var Promise         = require('es6-promise').Promise;
var _               = require('lodash');
var request         = require('request');
var querystring     = require('querystring');
var username        = '';
var password        = '';
var protocol        = 'http';
var host            = 'localhost';
var port            = '3000';
var uri             = '';
var client_id       = '';
var grant_type      = '';
var auth_endpoint   = 'http://localhost:3000/api/login/token';

var args = process.argv.slice(2);
if (args.length !== 8) {
    console.log('');
    console.log('Please specify proper parameters: <username> <password> <protocol> <host> <port> <client_id> <grant_type> <auth_endpoint>');
    console.log('');
    console.log('eg: node updateShapes.js admin admin http localhost 3000 client_id grant_type auth_endpoint');
    return;
} else {
    username        = args[0];
    password        = args[1];
    protocol        = args[2];
    host            = args[3];
    port            = args[4];
    client_id       = args[5];
    grant_type      = args[6];
    auth_endpoint   = args[7];
    uri = protocol + '://' + host + ':' + port + '/';
    console.log('Using connection:', uri);
}

// JWT Login
var jwt_login = null;
var login = function (username, password) {
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
        }, function (err, res, body) {
            if (err || res.statusCode !== 200) {
                console.log("err:", err, res);
                reject(null);
            } else {
                var data = JSON.parse(body);
                jwt_login = data.access_token;
                resolve(data.access_token);
            }
        });
    });
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
                    console.log("Applications to process:", obj.length);
                    resolve(obj);
                } catch (e) {
                    console.log("e:", e);
                }
            }
        });
    });
};

var getAndSaveFeatures = function (item) {
    // Get the shapes from BCGW for this DISPOSITION and save them into the feature collection
    var searchURL = "https://openmaps.gov.bc.ca/geo/pub/WHSE_TANTALIS.TA_CROWN_TENURES_SVW/ows?service=wfs&version=2.0.0&request=getfeature&typename=PUB:WHSE_TANTALIS.TA_CROWN_TENURES_SVW&outputFormat=json&srsName=EPSG:4326&CQL_FILTER=DISPOSITION_TRANSACTION_SID=";
    return new Promise(function (resolve, reject) {
        request({ url: searchURL + "'" + item.tantalisID + "'" }, function (err, res, body) {
            if (err) {
                reject(err);
            } else if (res.statusCode !== 200) {
                reject(res.statusCode + ' ' + body);
            } else {
                var obj = {};
                try {
                    obj = JSON.parse(body);
                } catch (e) {
                    // Fall through cleanly.
                    defaultLog.error('Parsing Failed.', e);
                    resolve(item);
                }

                // Store the features in the DB
                var allFeaturesForDisp = [];
                // don't clear previous value if no features
                if (obj.features.length > 0) {
                  item.areaHectares = 0.00;
                }
                var turf = require('@turf/turf');
                var helpers = require('@turf/helpers');
                var centroids = helpers.featureCollection([]);
                _.each(obj.features, function (f) {
                    // Tags default public
                    f.tags = [['sysadmin'], ['public']];
                    allFeaturesForDisp.push(f);
                    // Get the polygon and put it for later centroid calculation
                    centroids.features.push(turf.centroid(f));
                    // Calculate Total Area (hectares) from all features
                    if (f.properties && f.properties.TENURE_AREA_IN_HECTARES) {
                      item.areaHectares += parseFloat(f.properties.TENURE_AREA_IN_HECTARES);
                    }
                  });
                // Centroid of all the shapes.
                var featureCollectionCentroid;
                if (centroids.features.length > 0) {
                    featureCollectionCentroid = turf.centroid(centroids).geometry.coordinates;
                }

                Promise.resolve()
                .then(function () {
                    return allFeaturesForDisp.reduce(function (previousItem, currentItem) {
                        return previousItem.then(function () {
                            return doFeatureSave(currentItem, item._id);
                        });
                    }, Promise.resolve());
                }).then(function (f) {
                    // All done with promises in the array, return last feature to the caller, NB:
                    // Sometimes we won't have shapes in the in our DB, and sometimes the BCGW doesn't have shapes
                    // So we must make sure that we have a shape that was pulled from the BCGW in order to do anything.
                    if (f) {
                        // adding the centroid of all shapes to the obj.
                        if (featureCollectionCentroid) {
                            f.featureCollectionCentroid = featureCollectionCentroid;
                        }
                        f.areaHectares = item.areaHectares;
                    }
                    resolve(f);
                });
            }
        });
    });
};

var doFeatureSave = function (item, appId) {
    return new Promise(function (resolve, reject) {
        item.applicationID = appId;
        request.post({
            url: uri + 'api/feature',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + jwt_login
            },
            body: JSON.stringify(item)
        }, function (err, res, body) {
            if (err || res.statusCode !== 200) {
                console.log("err:", err, res);
                reject(null);
            } else {
                var data = JSON.parse(body);
                resolve(data);
            }
        });
    });
};

var deleteAllApplicationFeatures = function (item) {
    return new Promise(function (resolve, reject) {
        request.delete({
            url: uri + 'api/feature?applicationID=' + item._id,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + jwt_login
            },
        }, function (err, res, body) {
            if (err || res.statusCode !== 200) {
                console.log("err:", err, res);
                reject(null);
            } else {
                var data = JSON.parse(body);
                resolve(data);
            }
        });
    });
};

var updateApplicationMeta = function (item) {
    return new Promise(function (resolve, reject) {
        var updatedAppObject = {};
        updatedAppObject.businessUnit     = item.properties.RESPONSIBLE_BUSINESS_UNIT;
        updatedAppObject.purpose          = item.properties.TENURE_PURPOSE;
        updatedAppObject.subpurpose       = item.properties.TENURE_SUBPURPOSE;
        updatedAppObject.status           = item.properties.TENURE_STATUS;
        updatedAppObject.type             = item.properties.TENURE_TYPE;
        updatedAppObject.tenureStage      = item.properties.TENURE_STAGE;
        updatedAppObject.subtype          = item.properties.TENURE_SUBTYPE;
        updatedAppObject.location         = item.properties.TENURE_LOCATION;
        updatedAppObject.legalDescription = item.properties.TENURE_LEGAL_DESCRIPTION;
        updatedAppObject.centroid         = item.featureCollectionCentroid;
        updatedAppObject.areaHectares     = item.areaHectares;
        request.put({
            url: uri + 'api/application/' + item.applicationID,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + jwt_login
            },
            body: JSON.stringify(updatedAppObject),
        }, function (err, res, body) {
            if (err || res.statusCode !== 200) {
                console.log("err:", err, res);
                reject(null);
            } else {
                var data = JSON.parse(body);
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
        // Now iterate through each application, grabbing the tantalisID and populating the shapes in the feature collection.
        return new Promise(function (resolve, reject) {
            Promise.resolve()
                .then(function () {
                    return apps.reduce(function (current, item) {
                        return current.then(function () {
                            console.log("-------------------------------------------------------");
                            console.log("Deleting existing features.");
                            // First delete all the application features.  We blindly overwrite.
                            return deleteAllApplicationFeatures(item)
                                .then(function () {
                                    // Fetch and store the features in the feature collection for this
                                    // application.
                                    console.log("Fetching and storing features:", item._id);
                                    return getAndSaveFeatures(item);
                                })
                                .then(function (lastFeature) {
                                    if (lastFeature) {
                                        // Update the application meta.
                                        console.log("Updating application meta for DISP:", lastFeature.properties.DISPOSITION_TRANSACTION_SID);
                                        return updateApplicationMeta(lastFeature);
                                    } else {
                                        // No feature - don't update meta.
                                        console.log("No features found - not updating.");
                                        return Promise.resolve();
                                    }
                                });
                        });
                    }, Promise.resolve());
                }).then(resolve, reject);
        });
    })
    .catch(function (err) {
        console.log("ERR:", err);
    });
