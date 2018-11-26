var auth        = require("../helpers/auth");
var _           = require('lodash');
var defaultLog  = require('winston').loggers.get('default');
var mongoose    = require('mongoose');
var Actions     = require('../helpers/actions');
var Utils       = require('../helpers/utils');

var getSanitizedFields = function (fields) {
  return _.remove(fields, function (f) {
    return (_.indexOf(['name',
                        'startDate',
                        'endDate',
                        '_addedBy',
                        '_application',
                        'isDeleted'], f) !== -1);
  });
}

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

  Utils.runDataQuery('CommentPeriod',
                    ['public'],
                    query,
                    getSanitizedFields(args.swagger.params.fields.value), // Fields
                    null, // sort warmup
                    null, // sort
                    null, // skip
                    null, // limit
                    false) // count
  .then(function (data) {
    return Actions.sendResponse(res, 200, data);
  });
};

exports.protectedHead = function (args, res, next) {
  defaultLog.info("args.swagger.params:", args.swagger.operation["x-security-scopes"]);

  // Build match query if on CommentPeriodId route
  var query = {};
  if (args.swagger.params.CommentPeriodId && args.swagger.params.CommentPeriodId.value) {
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

  Utils.runDataQuery('CommentPeriod',
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
    // /api/commentperiod/ route, return 200 OK with 0 items if necessary
    if (!(args.swagger.params.CommentPeriodId && args.swagger.params.CommentPeriodId.value) || (data && data.length > 0)) {
      res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items: 0);
      return Actions.sendResponse(res, 200, data);
    } else {
      return Actions.sendResponse(res, 404, data);
    }
  });
}

exports.protectedGet = function(args, res, next) {
  var Comment = mongoose.model('CommentPeriod');

  defaultLog.info("args.swagger.params:", args.swagger.operation["x-security-scopes"]);

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

  Utils.runDataQuery('CommentPeriod',
                    args.swagger.operation["x-security-scopes"],
                    query,
                    getSanitizedFields(args.swagger.params.fields.value), // Fields
                    null, // sort warmup
                    null, // sort
                    null, // skip
                    null, // limit
                    false) // count
  .then(function (data) {
    return Actions.sendResponse(res, 200, data);
  });
};

//  Create a new CommentPeriod
exports.protectedPost = function (args, res, next) {
  var obj = args.swagger.params._commentPeriod.value;
  defaultLog.info("Incoming new object:", obj);
  defaultLog.info("args.swagger.params.auth_payload:", args.swagger.params.auth_payload);
  obj._addedBy = args.swagger.params.auth_payload.preferred_username.value;

  var CommentPeriod = mongoose.model('CommentPeriod');
  var commentperiod = new CommentPeriod(obj);

  // Define security tag defaults
  commentperiod.tags = [['sysadmin']];
  commentperiod._addedBy = args.swagger.params.auth_payload.preferred_username;
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
