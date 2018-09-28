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
  // Build match query if on CommentPeriodId route
  var query = {};
  if (args.swagger.params.CommentPeriodId) {
    query = Utils.buildQuery("_id", args.swagger.params.CommentPeriodId.value, query);
  }
  if (args.swagger.params._application && args.swagger.params._application.value) {
    query = Utils.buildQuery("_application", args.swagger.params._application.value, query);
  }
  _.assignIn(query, { isDeleted: false });

  getComments(['public'], query, args.swagger.params.fields.value)
  .then(function (data) {
    return Actions.sendResponse(res, 200, data);
  });
};
exports.protectedGet = function(args, res, next) {
  var Comment = mongoose.model('CommentPeriod');

  defaultLog.info("args.swagger.params:", args.swagger.params.auth_payload.scopes);

  // Build match query if on CommentPeriodId route
  var query = {};
  if (args.swagger.params.CommentPeriodId) {
    query = Utils.buildQuery("_id", args.swagger.params.CommentPeriodId.value, query);
  }
  if (args.swagger.params._application && args.swagger.params._application.value) {
    query = Utils.buildQuery("_application", args.swagger.params._application.value, query);
  }
  // Unless they specifically ask for it, hide deleted results.
  if (args.swagger.params.isDeleted && args.swagger.params.isDeleted.value != undefined) {
    _.assignIn(query, { isDeleted: args.swagger.params.isDeleted.value });
  } else {
    _.assignIn(query, { isDeleted: false });
  }

  getComments(args.swagger.params.auth_payload.scopes, query, args.swagger.params.fields.value)
  .then(function (data) {
    return Actions.sendResponse(res, 200, data);
  });
};

//  Create a new CommentPeriod
exports.protectedPost = function (args, res, next) {
  var obj = args.swagger.params._commentPeriod.value;
  defaultLog.info("Incoming new object:", obj);
  if (!obj.internal) {
    obj.internal = {};
  }
  obj.internal._addedBy = mongoose.Types.ObjectId(args.swagger.params.auth_payload.userID.value);
  obj._addedBy = mongoose.Types.ObjectId(args.swagger.params.auth_payload.userID.value);

  var CommentPeriod = mongoose.model('CommentPeriod');
  var commentperiod = new CommentPeriod(obj);

  // Define security tag defaults
  commentperiod.tags = [['sysadmin']];
  commentperiod.internal.tags = [['sysadmin']];
  commentperiod._addedBy = args.swagger.params.auth_payload.userID;
  commentperiod.save()
  .then(function (c) {
    // defaultLog.info("Saved new CommentPeriod object:", c);
    return Actions.sendResponse(res, 200, c);
  });
};

// Update an existing CommentPeriod
exports.protectedPut = function (args, res, next) {
  var objId = args.swagger.params.CommentPeriodId.value;
  defaultLog.info("ObjectID:", args.swagger.params.CommentPeriodId.value);
  var obj = args.swagger.params.cp.value;

  // Strip security tags - these will not be updated on this route.
  delete obj.tags;

  delete obj._addedBy;

  // Since it's a sub-element, we need to ensure we keep it updated to what it is.
  delete obj.internal.tags;
  obj.internal.tags = [['sysadmin']];
  defaultLog.info("Incoming updated object:", obj);
  // TODO sanitize/update audits.

  var commentperiod = require('mongoose').model('CommentPeriod');
  commentperiod.findOneAndUpdate({_id: objId}, obj, {upsert:false, new: true}, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);
      return Actions.sendResponse(res, 200, o);
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
}

//  Delete a new CommentPeriod
exports.protectedDelete = function (args, res, next) {
  var objId = args.swagger.params.CommentPeriodId.value;
  defaultLog.info("Delete CommentPeriod:", objId);

  var commentperiod = require('mongoose').model('CommentPeriod');
  commentperiod.findOne({_id: objId, isDeleted: false}, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);

      // Set the deleted flag.
      Actions.delete(o)
      .then(function (deleted) {
        // Deleted successfully
        return Actions.sendResponse(res, 200, deleted);
      }, function (err) {
        // Error
        defaultLog.info("Couldn't Execute!");
        return Actions.sendResponse(res, 400, err);
      });
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
};

// Publish/Unpublish the CommentPeriod
exports.protectedPublish = function (args, res, next) {
  var objId = args.swagger.params.CommentPeriodId.value;
  defaultLog.info("Publish CommentPeriod:", objId);

  var commentperiod = require('mongoose').model('CommentPeriod');
  commentperiod.findOne({_id: objId}, function (err, o) {
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
  var objId = args.swagger.params.CommentPeriodId.value;
  defaultLog.info("UnPublish CommentPeriod:", objId);

  var commentperiod = require('mongoose').model('CommentPeriod');
  commentperiod.findOne({_id: objId}, function (err, o) {
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
var getComments = function (role, query, fields) {
  return new Promise(function (resolve, reject) {
    var commentperiod = mongoose.model('CommentPeriod');
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
                        'startDate',
                        'endDate',
                        'description',
                        '_addedBy',
                        '_application',
                        'internal',
                        'isDeleted'], f) !== -1);
    });
    _.each(sanitizedFields, function (f) {
      projection[f] = 1;
    });

    commentperiod.aggregate([
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