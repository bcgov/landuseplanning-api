var auth        = require("../helpers/auth");
var _           = require('lodash');
var defaultLog  = require('winston').loggers.get('default');
var mongoose    = require('mongoose');
var qs          = require('qs');
var Actions     = require('../helpers/actions');
var Utils       = require('../helpers/utils');
var request     = require('request');
var tagList     = ['agency',
                    'areaHectares',
                    'businessUnit',
                    'centroid',
                    'cl_file',
                    'client',
                    '_createdBy',
                    'createdDate',
                    'description',
                    'legalDescription',
                    'statusHistoryEffectiveDate',
                    'location',
                    'name',
                    'publishDate',
                    'purpose',
                    'status',
                    'subpurpose',
                    'subtype',
                    'tantalisID',
                    'tenureStage',
                    'type'];

var getSanitizedFields = function (fields) {
  return _.remove(fields, function (f) {
    return (_.indexOf(tagList, f) !== -1);
  });
}

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

exports.publicHead = function (args, res, next) {
  // Build match query if on appId route
  var query   = {};

  // Add in the default fields to the projection so that the incoming query will work for any selected fields.
  tagList.push('_id');
  tagList.push('tags');

  var requestedFields = getSanitizedFields(args.swagger.params.fields.value);

  if (args.swagger.params.appId) {
    query = Utils.buildQuery("_id", args.swagger.params.appId.value, query);
  } else {
    try {
      query = addStandardQueryFilters(query, args);
    } catch (error) {
      return Actions.sendResponse(res, 400, { error: error.message });
    }
  }

  _.assignIn(query, { isDeleted: false });

  handleCommentPeriodDateQueryParameters(args, tagList, function (commentPeriodPipeline) {
    Utils.runDataQuery('Application',
                      ['public'],
                      query,
                      requestedFields, // Fields
                      null, // sort warmup
                      null, // sort
                      null, // skip
                      1000000, // limit
                      true,
                      commentPeriodPipeline) // count
      .then(function (data) {
        // /api/comment/ route, return 200 OK with 0 items if necessary
        if (!(args.swagger.params.appId && args.swagger.params.appId.value) || (data && data.length > 0)) {
          res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items: 0);
          return Actions.sendResponse(res, 200, data);
        } else {
          return Actions.sendResponse(res, 404, data);
        }
    });
  }, function (error) {
    return Actions.sendResponse(res, 400, error);
  });
};

exports.publicGet = function (args, res, next) {
  // Build match query if on appId route
  var query   = {};
  var skip    = null;
  var limit   = null;
  var requestedFields = getSanitizedFields(args.swagger.params.fields.value);
  // Add in the default fields to the projection so that the incoming query will work for any selected fields.
  tagList.push('_id');
  tagList.push('tags');

  if (args.swagger.params.appId) {
    query = Utils.buildQuery("_id", args.swagger.params.appId.value, query);
  } else {
    // Could be a bunch of results - enable pagination
    var processedParameters = Utils.getSkipLimitParameters(args.swagger.params.pageSize, args.swagger.params.pageNum);
    skip = processedParameters.skip;
    limit = processedParameters.limit;

    try {
      query = addStandardQueryFilters(query, args);
    } catch (error) {
      return Actions.sendResponse(res, 400, { error: error.message });
    }
  }

  _.assignIn(query, { isDeleted: false });

  handleCommentPeriodDateQueryParameters(args, tagList, function (commentPeriodPipeline) {
    Utils.runDataQuery('Application',
                      ['public'],
                      query,
                      requestedFields, // Fields
                      null, // sort warmup
                      null, // sort
                      skip, // skip
                      limit, // limit
                      false,
                      commentPeriodPipeline) // count
      .then(function (data) {
        return Actions.sendResponse(res, 200, data);
    });
  }, function (error) {
    return Actions.sendResponse(res, 400, error);
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

    try {
      query = addStandardQueryFilters(query, args);
    } catch (error) {
      return Actions.sendResponse(res, 400, { error: error.message });
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

  // Add in the default fields to the projection so that the incoming query will work for any selected fields.
  tagList.push('_id');
  tagList.push('tags');

  if (args.swagger.params.appId) {
    query = Utils.buildQuery("_id", args.swagger.params.appId.value, query);
  } else {
    try {
      query = addStandardQueryFilters(query, args);
    } catch (error) {
      return Actions.sendResponse(res, 400, { error: error.message });
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
                    tagList, // Fields
                    null, // sort warmup
                    null, // sort
                    null, // skip
                    1000000, // limit
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

  // Get rid of the fields we don't need/setting later below.
  delete(obj.areaHectares);
  delete(obj.centroid);
  delete(obj.purpose);
  delete(obj.subpurpose);
  delete(obj.type);
  delete(obj.subtype);
  delete(obj.status);
  delete(obj.tenureStage);
  delete(obj.location);
  delete(obj.businessUnit);
  delete(obj.cl_file);
  delete(obj.client);

  defaultLog.info("Incoming new object:", obj);

  var Application = mongoose.model('Application');
  var app = new Application(obj);
  // Define security tag defaults
  app.tags = [['sysadmin']];
  app._createdBy = args.swagger.params.auth_payload.preferred_username;
  app.createdDate = Date.now();
  app.save()
  .then(function (savedApp) {
    return new Promise(function (resolve, reject) {
      return Utils.loginWebADE()
      .then(function (accessToken) {
        _accessToken = accessToken;
        console.log("TTLS API Logged in:", _accessToken);
        // Disp lookup
        return Utils.getApplicationByDispositionID(_accessToken, savedApp.tantalisID);
      }).then(resolve, reject);
    }).then(function (data) {
      // Copy in the meta
      savedApp.areaHectares = data.areaHectares;
      savedApp.centroid     = data.centroid;
      savedApp.purpose      = data.TENURE_PURPOSE;
      savedApp.subpurpose   = data.TENURE_SUBPURPOSE;
      savedApp.type         = data.TENURE_TYPE;
      savedApp.subtype      = data.TENURE_SUBTYPE;
      savedApp.status       = data.TENURE_STATUS;
      savedApp.tenureStage  = data.TENURE_STAGE;
      savedApp.location     = data.TENURE_LOCATION;
      savedApp.businessUnit = data.RESPONSIBLE_BUSINESS_UNIT;
      savedApp.cl_file      = data.CROWN_LANDS_FILE;
      savedApp.tantalisID   = data.DISPOSITION_TRANSACTION_SID;

      for(let [idx,client] of Object.entries(data.interestedParties)) {
        if (idx > 0) {
          savedApp.client += ", ";
        }
        if (client.interestedPartyType == 'O') {
          savedApp.client += client.legalName;
        } else {
          savedApp.client += client.firstName + " " + client.lastName;
        }
      }

      Promise.resolve()
      .then(function () {
        return data.parcels.reduce(function (previousItem, currentItem) {
          return previousItem.then(function () {
            // publish
            currentItem.tags = [['sysadmin'],['public']];
            return doFeatureSave(currentItem, savedApp._id);
          });
        }, Promise.resolve());
      }).then(function () {
        // All done with promises in the array, return to the caller.
        console.log("all done");
        return savedApp.save();
      }).then(function (theApp) {
        return Actions.sendResponse(res, 200, theApp);
      });
    }).catch(function (err) {
      console.log("Error in API:", err);
      return Actions.sendResponse(res, 400, err);
    });
  });
};

// Update an existing application
exports.protectedPut = function (args, res, next) {
  var objId = args.swagger.params.appId.value;
  defaultLog.info("ObjectID:", args.swagger.params.appId.value);

  var obj = args.swagger.params.AppObject.value;
  // Strip security tags - these will not be updated on this route.
  delete obj.tags;
  defaultLog.info("Incoming updated object:", obj);
  // TODO sanitize/update audits.

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

var handleCommentPeriodDateQueryParameters = function (args, requestedFields, callback, error) {
  var pipelineSteps = null;
  var commentPeriodDates = [];

  // Date range logic
  if (args.swagger.params.cpStart && args.swagger.params.cpStart.value !== undefined) {
    var queryString = qs.parse(args.swagger.params.cpStart.value);
    if (queryString.eq) {
      commentPeriodDates.push({ $eq: [ "$commentPeriods.startDate", new Date(queryString.eq) ] });
    } else {
      // Which param was set?
      if (queryString.since) {
        commentPeriodDates.push({ $gte: [ "$commentPeriods.startDate", new Date(queryString.since) ] });
      }
      if (queryString.until) {
        commentPeriodDates.push({ $lte: [ "$commentPeriods.startDate", new Date(queryString.until) ] });
      }
    }
  }

  if (args.swagger.params.cpEnd && args.swagger.params.cpEnd.value !== undefined) {
    var queryString = qs.parse(args.swagger.params.cpEnd.value);
    if (queryString.eq) {
      commentPeriodDates.push({ $eq: [ "$commentPeriods.endDate", new Date(queryString.eq) ] });
    } else {
      // Which param was set?
      if (queryString.since) {
        commentPeriodDates.push({ $gte: [ "$commentPeriods.endDate", new Date(queryString.since) ] });
      }
      if (queryString.until) {
        commentPeriodDates.push({ $lte: [ "$commentPeriods.endDate", new Date(queryString.until) ] });
      }
    }
  }

  // Did we want to filter based on comment period?
  if (commentPeriodDates.length > 0) {
    // NB: These are in reverse order in order to unshift into the pipline in proper order,
    // since we are querying commentPeriods and then left-joining the application query.
    var projection = {};
    var fields = [...['_id','isDeleted','tags'], ...requestedFields];
    for (let f of fields) {
      projection[f] = 1;
    }

    if (commentPeriodDates.length > 1) {
      projection.result = { $and: [ commentPeriodDates.pop(), commentPeriodDates.pop() ]};
    } else if (commentPeriodDates.length > 0) {
      projection.result = commentPeriodDates.pop();
    }

    pipelineSteps = [
      {
        $match : { result : true }
      },
      {
        $project: projection
      },
      {
        $unwind: "$commentPeriods"
      },
      {
        $lookup: {
          from: "commentperiods",
          localField: "_id",    // field in the orders collection
          foreignField: "_application",  // field in the items collection
          as: "commentPeriods"
        }
      }
    ];
  }

  return callback(pipelineSteps);
};

var addStandardQueryFilters = function (query, args) {
  if (args.swagger.params.publishDate && args.swagger.params.publishDate.value !== undefined) {
    var queryString = qs.parse(args.swagger.params.publishDate.value);
    if (queryString.since && queryString.until) {
      // Combine queries as logical AND for the dataset.
      _.assignIn(query, {
        $and: [
          {
            publishDate: { $gte: new Date(queryString.since) }
          },
          {
            publishDate: { $lte: new Date(queryString.until) }
          }
        ]
      });
    } else if (queryString.eq) {
      _.assignIn(query, {
        publishDate: { $eq: new Date(queryString.eq)}
      });
    } else {
      // Which param was set?
      if (queryString.since) {
        _.assignIn(query, {
          publishDate: { $gte: new Date(queryString.since)}
        });
      }
      if (queryString.until) {
        _.assignIn(query, {
          publishDate: { $lte: new Date(queryString.until)}
        });
      }
    }
  }
  if (args.swagger.params.tantalisId && args.swagger.params.tantalisId.value !== undefined) {
    _.assignIn(query, { tantalisID: args.swagger.params.tantalisId.value });
  }
  if (args.swagger.params.cl_file && args.swagger.params.cl_file.value !== undefined) {
    _.assignIn(query, { cl_file: args.swagger.params.cl_file.value });
  }
  if (args.swagger.params.purpose && args.swagger.params.purpose.value !== undefined) {
    var queryString = qs.parse(args.swagger.params.purpose.value);
    var queryArray = [];
    if (Array.isArray(queryString.eq)) {
      queryArray = queryString.eq;
    } else {
      queryArray.push(queryString.eq);
    }
    _.assignIn(query, { purpose: { $in: queryArray } });
  }
  if (args.swagger.params.subpurpose && args.swagger.params.subpurpose.value !== undefined) {
    var queryString = qs.parse(args.swagger.params.subpurpose.value);
    var queryArray = [];
    if (Array.isArray(queryString.eq)) {
      queryArray = queryString.eq;
    } else {
      queryArray.push(queryString.eq);
    }
    _.assignIn(query, { subpurpose: { $in: queryArray } });
  }
  if (args.swagger.params.type && args.swagger.params.type.value !== undefined) {
    _.assignIn(query, { type: args.swagger.params.type.value });
  }
  if (args.swagger.params.subtype && args.swagger.params.subtype.value !== undefined) {
    _.assignIn(query, { subtype: args.swagger.params.subtype.value });
  }
  if (args.swagger.params.status && args.swagger.params.status.value !== undefined) {
    var queryString = qs.parse(args.swagger.params.status.value);
    var queryArray = [];
    if (Array.isArray(queryString.eq)) {
      queryArray = queryString.eq;
    } else {
      queryArray.push(queryString.eq);
    }
    _.assignIn(query, { status: { $in: queryArray } });
  }
  if (args.swagger.params.agency && args.swagger.params.agency.value !== undefined) {
    _.assignIn(query, { agency: args.swagger.params.agency.value });
  }
  if (args.swagger.params.businessUnit && args.swagger.params.businessUnit.value !== undefined) {
    _.assignIn(query, { businessUnit: args.swagger.params.businessUnit.value });
  }
  if (args.swagger.params.client && args.swagger.params.client.value !== undefined) {
    _.assignIn(query, { client: args.swagger.params.client.value });
  }
  if (args.swagger.params.tenureStage && args.swagger.params.tenureStage.value !== undefined) {
    _.assignIn(query, { tenureStage: args.swagger.params.tenureStage.value });
  }
  if (args.swagger.params.areaHectares && args.swagger.params.areaHectares.value !== undefined) {
    var queryString = qs.parse(args.swagger.params.areaHectares.value);
    if (queryString.gte && queryString.lte) {
      // Combine queries as logical AND to compute a Rnage of values.
      _.assignIn(query, {
        $and: [
          {
            areaHectares: { $gte: parseFloat(queryString.gte, 10) }
          },
          {
            areaHectares: { $lte: parseFloat(queryString.lte, 10) }
          }
        ]
      });
    } else if (queryString.eq) {
      // invalid or not specified, treat as equal
      _.assignIn(query, {
        areaHectares: { $eq: parseFloat(queryString.eq, 10)}
      });
    } else {
      // Which param was set?
      if (queryString.gte) {
        _.assignIn(query, {
          areaHectares: { $gte: parseFloat(queryString.gte, 10)}
        });
      }
      if (queryString.lte) {
        _.assignIn(query, {
          areaHectares: { $lte: parseFloat(queryString.lte, 10)}
        });
      }
    }
  }
  if (args.swagger.params.centroid && args.swagger.params.centroid.value !== undefined) {
    // defaultLog.info("Looking up features based on coords:", args.swagger.params.centroid.value);
    // Throws if parsing fails.
    const coordinates = JSON.parse(args.swagger.params.centroid.value)[0];
    if (coordinates.length == 2) {
      // use geoWithin box query
      _.assignIn(query, {
        centroid: {
          $geoWithin: {
            $box: coordinates
          }
        }
      });
    } else {
      // use geoIntersects polygon query
      // specify custom MongoDB CRS to support queries with area larger than a single hemisphere
      _.assignIn(query, {
        centroid: {
          $geoIntersects: {
            $geometry: {
              type: "Polygon",
              coordinates: [coordinates],
              crs: {
                type: "name",
                properties: { name: "urn:x-mongodb:crs:strictwinding:EPSG:4326" }
              }
            }
          }
        }
      });
    }
  }
  // Allows filtering of apps that have had their last status change greater than this epoch time.
  if (args.swagger.params.statusHistoryEffectiveDate && args.swagger.params.statusHistoryEffectiveDate !== undefined) {
    var queryString = qs.parse(args.swagger.params.statusHistoryEffectiveDate.value);
    _.assignIn(query, {
      $or: [ { statusHistoryEffectiveDate: null }, { statusHistoryEffectiveDate: { $gte: parseInt(queryString.gte, 10) } } ]
    });
  }
  return query;
}