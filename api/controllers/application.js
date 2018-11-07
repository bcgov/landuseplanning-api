var auth        = require("../helpers/auth");
var _           = require('lodash');
var defaultLog  = require('winston').loggers.get('default');
var mongoose    = require('mongoose');
var Actions     = require('../helpers/actions');
var Utils       = require('../helpers/utils');
var request     = require('request');

var getSanitizedFields = function (fields) {
  return _.remove(fields, function (f) {
    return (_.indexOf(['agency',
                      'areaHectares',
                      'businessUnit',
                      'centroid',
                      'cl_file',
                      'client',
                      '_createdBy',
                      'createdDate',
                      'description',
                      'internal',
                      'legalDescription',
                      'location',
                      'name',
                      '_proponent',
                      'publishDate',
                      'purpose',
                      'status',
                      'subpurpose',
                      'subtype',
                      'tantalisID',
                      'tenureStage',
                      'type'], f) !== -1);
  });
}

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

exports.publicHead = function (args, res, next) {
  // Build match query if on appId route
  var query   = {};
  var skip    = null;
  var limit   = null;

  if (args.swagger.params.appId) {
    query = Utils.buildQuery("_id", args.swagger.params.appId.value, query);
  } else {
    // Could be a bunch of results - enable pagination
    var processedParameters = Utils.getSkipLimitParameters(args.swagger.params.pageSize, args.swagger.params.pageNum);
    skip = processedParameters.skip;
    limit = processedParameters.limit;

    if (args.swagger.params.tantalisId && args.swagger.params.tantalisId.value !== undefined) {
      _.assignIn(query, { tantalisID: args.swagger.params.tantalisId.value });
    }
    if (args.swagger.params.cl_file && args.swagger.params.cl_file.value !== undefined) {
      _.assignIn(query, { cl_file: args.swagger.params.cl_file.value });
    }
  }

  _.assignIn(query, { isDeleted: false });

  Utils.runDataQuery('Application',
                    ['public'],
                    query,
                    ['_id',
                      'tags'], // Fields
                    null, // sort warmup
                    null, // sort
                    skip, // skip
                    limit, // limit
                    true) // count
  .then(function (data) {
    // /api/comment/ route, return 200 OK with 0 items if necessary
    if (!(args.swagger.params.appId && args.swagger.params.appId.value) || (data && data.length > 0)) {
      res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items: 0);
      return Actions.sendResponse(res, 200, data);
    } else {
      return Actions.sendResponse(res, 404, data);
    }
  });
};

exports.publicGet = function (args, res, next) {
  // Build match query if on appId route
  var query   = {};
  var skip    = null;
  var limit   = null;

  if (args.swagger.params.appId) {
    query = Utils.buildQuery("_id", args.swagger.params.appId.value, query);
  } else {
    // Could be a bunch of results - enable pagination
    var processedParameters = Utils.getSkipLimitParameters(args.swagger.params.pageSize, args.swagger.params.pageNum);
    skip = processedParameters.skip;
    limit = processedParameters.limit;

    if (args.swagger.params.tantalisId && args.swagger.params.tantalisId.value !== undefined) {
      _.assignIn(query, { tantalisID: args.swagger.params.tantalisId.value });
    }
    if (args.swagger.params.cl_file && args.swagger.params.cl_file.value !== undefined) {
      _.assignIn(query, { cl_file: args.swagger.params.cl_file.value });
    }
  }

  _.assignIn(query, { isDeleted: false });

  Utils.runDataQuery('Application',
                    ['public'],
                    query,
                    getSanitizedFields(args.swagger.params.fields.value), // Fields
                    null, // sort warmup
                    null, // sort
                    skip, // skip
                    limit, // limit
                    false) // count
  .then(function (data) {
    return Actions.sendResponse(res, 200, data);
  });
};

exports.protectedGet = function(args, res, next) {
  var self        = this;
  var skip        = null;
  var limit       = null;

  var Application = mongoose.model('Application');

  defaultLog.info("args.swagger.params:", args.swagger.operation["x-security-scopes"]);

  // Build match query if on appId route
  var query = {};
  if (args.swagger.params.appId) {
    query = Utils.buildQuery("_id", args.swagger.params.appId.value, query);
  } else {
    // Could be a bunch of results - enable pagination
    var processedParameters = Utils.getSkipLimitParameters(args.swagger.params.pageSize, args.swagger.params.pageNum);
    skip = processedParameters.skip;
    limit = processedParameters.limit;

    if (args.swagger.params.tantalisId && args.swagger.params.tantalisId.value !== undefined) {
      _.assignIn(query, { tantalisID: args.swagger.params.tantalisId.value });
    }
    if (args.swagger.params.cl_file && args.swagger.params.cl_file.value !== undefined) {
      _.assignIn(query, { cl_file: args.swagger.params.cl_file.value });
    }
  }

  // Unless they specifically ask for it, hide deleted results.
  if (args.swagger.params.isDeleted && args.swagger.params.isDeleted.value !== undefined) {
    _.assignIn(query, { isDeleted: args.swagger.params.isDeleted.value });
  } else {
    _.assignIn(query, { isDeleted: false });
  }

  Utils.runDataQuery('Application',
                    args.swagger.operation["x-security-scopes"],
                    query,
                    getSanitizedFields(args.swagger.params.fields.value), // Fields
                    null, // sort warmup
                    null, // sort
                    skip, // skip
                    limit, // limit
                    false) // count
  .then(function (data) {
    return Actions.sendResponse(res, 200, data);
  });
};

exports.protectedHead = function (args, res, next) {
  defaultLog.info("args.swagger.params:", args.swagger.operation["x-security-scopes"]);

  // Build match query if on appId route
  var query = {};
  if (args.swagger.params.appId) {
    query = Utils.buildQuery("_id", args.swagger.params.appId.value, query);
  } else {
    if (args.swagger.params.tantalisId && args.swagger.params.tantalisId.value !== undefined) {
      _.assignIn(query, { tantalisID: args.swagger.params.tantalisId.value });
    }
    if (args.swagger.params.cl_file && args.swagger.params.cl_file.value !== undefined) {
      _.assignIn(query, { cl_file: args.swagger.params.cl_file.value });
    }
  }

  // Unless they specifically ask for it, hide deleted results.
  if (args.swagger.params.isDeleted && args.swagger.params.isDeleted.value !== undefined) {
    _.assignIn(query, { isDeleted: args.swagger.params.isDeleted.value });
  } else {
    _.assignIn(query, { isDeleted: false });
  }

  Utils.runDataQuery('Application',
                    args.swagger.operation["x-security-scopes"],
                    query,
                    ['_id',
                      'tags'], // Fields
                    null, // sort warmup
                    null, // sort
                    null, // skip
                    null, // limit
                    true) // count
  .then(function (data) {
    // /api/comment/ route, return 200 OK with 0 items if necessary
    if (!(args.swagger.params.appId && args.swagger.params.appId.value) || (data && data.length > 0)) {
      res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items: 0);
      return Actions.sendResponse(res, 200, data);
    } else {
      return Actions.sendResponse(res, 404, data);
    }
  });
};

exports.protectedDelete = function (args, res, next) {
  var appId = args.swagger.params.appId.value;
  defaultLog.info("Delete Application:", appId);

  var Application = mongoose.model('Application');
  Application.findOne({_id: appId}, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);

      // Set the deleted flag.
      Actions.delete(o)
      .then(function (deleted) {
        // Deleted successfully
        return Actions.sendResponse(res, 200, deleted);
      }, function (err) {
        // Error
        return Actions.sendResponse(res, 400, err);
      });
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
}

var doFeaturePubUnPub = function (action, objId) {
  return new Promise(function (resolve, reject) {
    var Feature = require('mongoose').model('Feature');

    Feature.find({applicationID: objId}, function (err, featureObjects) {
      if (err) {
        reject(err);
      } else {
        var promises = [];
        _.each(featureObjects, function (f) {
          promises.push(f);
        });
        // Iterate through all the promises before returning.
        Promise.resolve()
        .then(function () {
          return promises.reduce(function (previousItem, currentItem) {
            return previousItem.then(function () {
              if (action == 'publish') {
                if (!Actions.isPublished(currentItem)) {
                  return Actions.publish(currentItem);
                } else {
                  return Promise.resolve();
                }
              } else {
                // Default unpub
                if (Actions.isPublished(currentItem)) {
                  return Actions.unPublish(currentItem);
                } else {
                  return Promise.resolve();
                }
              }
            });
          }, Promise.resolve());
        }).then(function () {
          // All done with promises in the array, return to the caller.
          defaultLog.info("done Pub/UnPub all features.");
          resolve();
        });
      }
    });
  });
}

var doFeatureSave = function (item, appId) {
  return new Promise(function (resolve, reject) {
    // MBL TODO: What to do if feature was already in?
    var Feature = mongoose.model('Feature');
    var feat    = new Feature(item);

    // Bind reference to application Obj
    feat.applicationID = appId;
    feat.save().then(resolve, reject);
  });
};

//  Create a new application
exports.protectedPost = function (args, res, next) {
  var obj = args.swagger.params.app.value;
  defaultLog.info("Incoming new object:", obj);

  var Application = mongoose.model('Application');
  var app = new Application(obj);
  // Define security tag defaults
  app.tags = [['sysadmin']];
  app.internal.tags = [['sysadmin']];
  app._createdBy = args.swagger.params.auth_payload.userID;
  app.createdDate = Date.now();
  app.save()
  .then(function (savedApp) {
    // Get the shapes from BCGW for this DISPOSITION and save them into the feature collection
    var searchURL = "https://openmaps.gov.bc.ca/geo/pub/WHSE_TANTALIS.TA_CROWN_TENURES_SVW/ows?service=wfs&version=2.0.0&request=getfeature&typename=PUB:WHSE_TANTALIS.TA_CROWN_TENURES_SVW&outputFormat=json&srsName=EPSG:4326&CQL_FILTER=DISPOSITION_TRANSACTION_SID=";
    defaultLog.info("SEARCHING:", searchURL+ "'" + savedApp.tantalisID + "'");
    return new Promise(function (resolve, reject) {
      request({url: searchURL + "'" + savedApp.tantalisID + "'"}, function (err, res, body) {
        if (err) {
          reject(err);
        } else if (res.statusCode !== 200) {
          reject(res.statusCode+' '+body);
        } else {
          var obj = {};
          try {
            defaultLog.info ('BCGW Call Complete.', body);
            obj = JSON.parse(body);

            // Store the features in the DB
            var allFeaturesForDisp = [];
            // don't clear previous value if no features
            if (obj.features.length > 0) {
              savedApp.areaHectares = 0.00;
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
                  savedApp.areaHectares += parseFloat(f.properties.TENURE_AREA_IN_HECTARES);
                }
            });
            // Centroid of all the shapes.
            var featureCollectionCentroid;
            if (centroids.features.length > 0) {
              featureCollectionCentroid = turf.centroid(centroids).geometry.coordinates;
              // Store the centroid.
              savedApp.centroid = featureCollectionCentroid;
            }

            Promise.resolve()
            .then(function () {
              return allFeaturesForDisp.reduce(function (previousItem, currentItem) {
                return previousItem.then(function () {
                  return doFeatureSave(currentItem, savedApp._id);
                });
              }, Promise.resolve());
            }).then(function () {
              // All done with promises in the array, return to the caller.
              return savedApp.save();
            })
            .then(function (a) {
              resolve(a);
            });
          } catch (e) {
            defaultLog.error ('Parsing Failed.', e);
            resolve(savedApp);
          }
        }
      });
    });
  }).then(function (theApp) {
    // defaultLog.info("Saved new application object:", a);
    return Actions.sendResponse(res, 200, theApp);
  })
};

// Update an existing application
exports.protectedPut = function (args, res, next) {
  var objId = args.swagger.params.appId.value;
  defaultLog.info("ObjectID:", args.swagger.params.appId.value);

  var obj = args.swagger.params.AppObject.value;
  // Strip security tags - these will not be updated on this route.
  delete obj.tags;
  if (obj.internal && obj.internal.tags) {
    delete obj.internal.tags;
  }
  defaultLog.info("Incoming updated object:", obj);
  // TODO sanitize/update audits.

  // Never allow this to be updated
  if (obj.internal) {
    delete obj.internal.tags;
    obj.internal.tags = [['sysadmin']];
  }

  var Application = require('mongoose').model('Application');
  Application.findOneAndUpdate({_id: objId}, obj, {upsert:false, new: true}, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);
      return Actions.sendResponse(res, 200, o);
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
}

// Publish/Unpublish the application
exports.protectedPublish = function (args, res, next) {
  var objId = args.swagger.params.appId.value;
  defaultLog.info("Publish Application:", objId);

  var Application = require('mongoose').model('Application');
  Application.findOne({_id: objId}, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);

      // Go through the feature collection and publish the corresponding features.
      doFeaturePubUnPub('publish', objId).then(function () {
        // Publish the application
        return Actions.publish(o);
      }).then(function (published) {
        // Published successfully
        return Actions.sendResponse(res, 200, published);
      }, function (err) {
        // Error
        return Actions.sendResponse(res, err.code, err);
      });
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
};
exports.protectedUnPublish = function (args, res, next) {
  var objId = args.swagger.params.appId.value;
  defaultLog.info("UnPublish Application:", objId);

  var Application = require('mongoose').model('Application');
  Application.findOne({_id: objId}, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);

      // Go through the feature collection and publish the corresponding features.
      doFeaturePubUnPub('unpublish',objId).then(function () {
        return Actions.unPublish(o);
      }).then(function (unpublished) {
        // UnPublished successfully
        return Actions.sendResponse(res, 200, unpublished);
      }, function (err) {
        // Error
        return Actions.sendResponse(res, err.code, err);
      });
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
};
