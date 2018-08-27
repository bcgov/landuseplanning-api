var auth        = require("../helpers/auth");
var _           = require('lodash');
var defaultLog  = require('winston').loggers.get('default');
var mongoose    = require('mongoose');
var Actions     = require('../helpers/actions');
var Utils       = require('../helpers/utils');

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

exports.publicGet = function (args, res, next) {
  var query = {};
  // Build match query if on featureId route
  if (args.swagger.params.featureId) {
    query = Utils.buildQuery("_id", args.swagger.params.featureId.value, query);
  } else {
    if (args.swagger.params.coordinates && args.swagger.params.coordinates.value !== undefined) {
      defaultLog.info("Looking up features based on coords:", args.swagger.params.coordinates.value);
      try {
        query = { geometry: { $geoIntersects: { $geometry: { type: "Polygon", coordinates: JSON.parse(args.swagger.params.coordinates.value) } } }};
      } catch (e) {
        defaultLog.info("Parsing Error:", e);
        return Actions.sendResponse(res, 400, err);
      }
    }
  }
  if (args.swagger.params.applicationId && args.swagger.params.applicationId.value !== undefined) {
    _.assignIn(query, { applicationID: mongoose.Types.ObjectId(args.swagger.params.applicationId.value) });
  }
  if (args.swagger.params.tantalisId && args.swagger.params.tantalisId.value !== undefined) {
    _.assignIn(query, { 'properties.DISPOSITION_TRANSACTION_SID': args.swagger.params.tantalisId.value });
  }
  _.assignIn(query, { isDeleted: false });

  getFeatures(['public'], query, args.swagger.params.fields.value)
  .then(function (data) {
    return Actions.sendResponse(res, 200, data);
  });
};
exports.protectedGet = function(args, res, next) {
  var self        = this;
  self.scopes     = args.swagger.params.auth_payload.scopes;

  var Feature = mongoose.model('Feature');

  defaultLog.info("args.swagger.params:", args.swagger.params.auth_payload.scopes);

  var query = {};
  // Build match query if on featureId route
  if (args.swagger.params.featureId) {
    query = Utils.buildQuery("_id", args.swagger.params.featureId.value, query);
  } else {
    if (args.swagger.params.coordinates && args.swagger.params.coordinates.value !== undefined) {
      defaultLog.info("Looking up features based on coords:", args.swagger.params.coordinates.value);
      try {
        query = { geometry: { $geoIntersects: { $geometry: { type: "Polygon", coordinates: JSON.parse(args.swagger.params.coordinates.value) } } }};
      } catch (e) {
        defaultLog.info("Parsing Error:", e);
        return Actions.sendResponse(res, 400, err);
      }
    }
  }
  if (args.swagger.params.applicationId && args.swagger.params.applicationId.value !== undefined) {
    _.assignIn(query, { applicationID: mongoose.Types.ObjectId(args.swagger.params.applicationId.value) });
  }
  if (args.swagger.params.tantalisId && args.swagger.params.tantalisId.value !== undefined) {
    _.assignIn(query, { 'properties.DISPOSITION_TRANSACTION_SID': args.swagger.params.tantalisId.value });
  }
  // Unless they specifically ask for it, hide deleted results.
  if (args.swagger.params.isDeleted && args.swagger.params.isDeleted.value !== undefined) {
    _.assignIn(query, { isDeleted: args.swagger.params.isDeleted.value });
  } else {
    _.assignIn(query, { isDeleted: false });
  }

  getFeatures(args.swagger.params.auth_payload.scopes, query, args.swagger.params.fields.value)
  .then(function (data) {
    return Actions.sendResponse(res, 200, data);
  });
};

exports.protectedDelete = function (args, res, next) {
  var featureId = args.swagger.params.featureId.value;
  defaultLog.info("Delete Feature:", featureId);

  var Feature = mongoose.model('Feature');
  Feature.findOne({_id: featureId}, function (err, o) {
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

//  Create a new Feature
exports.protectedPost = function (args, res, next) {
  var obj = args.swagger.params.feature.value;
  defaultLog.info("Incoming new object:", obj);

  var Feature = mongoose.model('Feature');
  var feature = new Feature(obj);
  // Define security tag defaults.  Default public and sysadmin.
  feature.tags = [['sysadmin'], ['public']];
  feature.save()
  .then(function (a) {
    // defaultLog.info("Saved new Feature object:", a);
    return Actions.sendResponse(res, 200, a);
  });
};

// Update an existing Feature
exports.protectedPut = function (args, res, next) {
  var objId = args.swagger.params.featureId.value;
  defaultLog.info("ObjectID:", args.swagger.params.featureId.value);

  var obj = args.swagger.params.FeatureObject.value;
  // Strip security tags - these will not be updated on this route.
  delete obj.tags;
  defaultLog.info("Incoming updated object:", obj);
  // TODO sanitize/update audits.

  var Feature = require('mongoose').model('Feature');
  Feature.findOneAndUpdate({_id: objId}, obj, {upsert:false, new: true}, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);
      return Actions.sendResponse(res, 200, o);
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
}

// Publish/Unpublish the Feature
exports.protectedPublish = function (args, res, next) {
  var objId = args.swagger.params.featureId.value;
  defaultLog.info("Publish Feature:", objId);

  var Feature = require('mongoose').model('Feature');
  Feature.findOne({_id: objId}, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);

      // Add public to the tag of this obj.
      Actions.publish(o)
      .then(function (published) {
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
  var objId = args.swagger.params.featureId.value;
  defaultLog.info("UnPublish Feature:", objId);

  var Feature = require('mongoose').model('Feature');
  Feature.findOne({_id: objId}, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);

      // Remove public to the tag of this obj.
      Actions.unPublish(o)
      .then(function (unpublished) {
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
var getFeatures = function (role, query, fields) {
  return new Promise(function (resolve, reject) {
    var Feature = mongoose.model('Feature');
    var projection = {};

    // Fields we always return
    var defaultFields = ['_id',
                        'type',
                        'tags'];
    _.each(defaultFields, function (f) {
        projection[f] = 1;
    });

    // Add requested fields - sanitize first by including only those that we can/want to return
    var sanitizedFields = _.remove(fields, function (f) {
      return (_.indexOf(['type',
                        'tags',
                        'geometry',
                        'geometryName',
                        'properties',
                        'isDeleted',
                        'applicationID'], f) !== -1);
    });
    _.each(sanitizedFields, function (f) {
      projection[f] = 1;
    });

    Feature.aggregate([
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
              $and: [
                // This checks to see that 'tags' field exists before doing the RBAC compare for
                // redaction.  If it doesn't contain the 'tags' field, then we allow the result.
                { $cond: { if: "$tags", then: true, else: false } },
                {
                  $anyElementTrue: {
                    $map: {
                      input: "$tags" ,
                      as: "fieldTag",
                      in: { $setIsSubset: [ "$$fieldTag", role ] }
                    }
                  }
                }
              ]
            },
            then: "$$DESCEND",
            else: {
              // If the object didn't have the $tags field, allow recursion
              // If the object had the tags field, prune it as it failed RBAC
              $cond: { if: "$tags", then: "$$PRUNE", else: "$$DESCEND" }
            }
          }
        }
      }
    ]).exec()
    .then(function (data) {
      // Strip the tags from any object because this is geoJSON
      _.each(data, function (d) {
        function removeTags(obj) {
          for(prop in obj) {
            if (prop === 'tags')
              delete obj[prop];
            else if (typeof obj[prop] === 'object')
              removeTags(obj[prop]);
          }
        }

        removeTags(d);
      });
      resolve(data);
    });
  });
};