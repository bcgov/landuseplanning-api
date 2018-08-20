var auth        = require("../helpers/auth");
var _           = require('lodash');
var defaultLog  = require('winston').loggers.get('default');
var mongoose    = require('mongoose');
var Actions     = require('../helpers/actions');
var Utils       = require('../helpers/utils');
var request     = require('request');

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

exports.publicGet = function (args, res, next) {
  // Build match query if on appId route
  var query = {};
  if (args.swagger.params.appId) {
    query = Utils.buildQuery("_id", args.swagger.params.appId.value, query);
  }
  _.assignIn(query, { isDeleted: false });

  getApplications(['public'], query, args.swagger.params.fields.value)
  .then(function (data) {
    return Actions.sendResponse(res, 200, data);
  });
};
exports.protectedGet = function(args, res, next) {
  var self        = this;
  self.scopes     = args.swagger.params.auth_payload.scopes;

  var Application = mongoose.model('Application');

  defaultLog.info("args.swagger.params:", args.swagger.params.auth_payload.scopes);

  // Build match query if on appId route
  var query = {};
  if (args.swagger.params.appId) {
    query = Utils.buildQuery("_id", args.swagger.params.appId.value, query);
  }
  if (args.swagger.params.tantalisId && args.swagger.params.tantalisId.value !== undefined) {
    _.assignIn(query, { tantalisID: args.swagger.params.tantalisId.value });
  }
  // Unless they specifically ask for it, hide deleted results.
  if (args.swagger.params.isDeleted && args.swagger.params.isDeleted.value !== undefined) {
    _.assignIn(query, { isDeleted: args.swagger.params.isDeleted.value });
  } else {
    _.assignIn(query, { isDeleted: false });
  }

  getApplications(args.swagger.params.auth_payload.scopes, query, args.swagger.params.fields.value)
  .then(function (data) {
    return Actions.sendResponse(res, 200, data);
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
  app._addedBy = args.swagger.params.auth_payload.userID;
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
                  return doFeatureSave(currentItem, savedApp._id);
                });
              }, Promise.resolve());
            }).then(function () {
              // All done with promises in the array, return to the caller.
              resolve(savedApp);
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
        Actions.unPublish(o);
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
var getApplications = function (role, query, fields) {
  return new Promise(function (resolve, reject) {
    var Application = mongoose.model('Application');
    var projection = {};

    // Fields we always return
    var defaultFields = ['_id',
                        'code',
                        'tags'];
    _.each(defaultFields, function (f) {
        projection[f] = 1;
    });

    // Add requested fields - sanitize first by including only those that we can/want to return
    var sanitizedFields = _.remove(fields, function (f) {
      return (_.indexOf(['name',
                        'type',
                        'client',
                        'agency',
                        'subtype',
                        'internal',
                        'purpose',
                        'subpurpose',
                        '_proponent',
                        'latitude',
                        'longitude',
                        'areaHectares',
                        'location',
                        'region',
                        'description',
                        'legalDescription',
                        'status',
                        'publishDate',
                        'businessUnit',
                        'tantalisID',
                        'cl_file',
                        'commodityType',
                        'commodity',
                        'commodities'], f) !== -1);
    });
    _.each(sanitizedFields, function (f) {
      projection[f] = 1;
    });

    Application.aggregate([
      {
        "$match": query
      },
      {
        "$project": projection
      },
      {
        $redact: {
         $cond: {
            if: {
              $anyElementTrue: {
                    $map: {
                      input: "$tags" ,
                      as: "fieldTag",
                      in: { $setIsSubset: [ "$$fieldTag", role ] }
                    }
                  }
                },
              then: "$$DESCEND",
              else: "$$PRUNE"
            }
          }
        }
    ]).exec()
    .then(function (data) {
      defaultLog.info("data:", data);
      resolve(data);
    });
  });
};