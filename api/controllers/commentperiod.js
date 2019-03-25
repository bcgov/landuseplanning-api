var auth = require("../helpers/auth");
var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');

var getSanitizedFields = function (fields) {
  return _.remove(fields, function (f) {
    return (_.indexOf([
      '__v',
      '_schemaName',
      'addedBy',
      'additionalText',
      'ceaaAdditionalText',
      'ceaaInformationLabel',
      'ceaaRelatedDocuments',
      'classificationRoles',
      'classifiedPercent',
      'commenterRoles',
      'dateAdded',
      'dateCompleted',
      'dateCompletedEst',
      'dateStarted',
      'dateStartedEst',
      'dateUpdated',
      'downloadRoles',
      'informationLabel',
      'instructions',
      'isClassified',
      'isPublished',
      'isResolved',
      'isVetted',
      'milestone',
      'openHouses',
      'periodType',
      'phase',
      'phaseName',
      'project',
      'publishedPercent',
      'rangeOption',
      'rangeType',
      'relatedDocuments',
      'resolvedPercent',
      'updatedBy',
      'userCan',
      'vettedPercent',
      'vettingRoles',

      'read',
      'write',
      'delete'
    ], f) !== -1);
  });
}

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

exports.publicGet = async function (args, res, next) {
  // Build match query if on CommentPeriodId route
  var query = {}, sort = {};
  if (args.swagger.params.commentPeriodId) {
    query = Utils.buildQuery("_id", args.swagger.params.commentPeriodId.value, query);
  }
  if (args.swagger.params.project && args.swagger.params.project.value) {
    query = Utils.buildQuery("project", args.swagger.params.project.value, query);
  }
  if (args.swagger.params.sortBy && args.swagger.params.sortBy.value) {
    args.swagger.params.sortBy.value.forEach(function (value) {
      var order_by = value.charAt(0) == '-' ? -1 : 1;
      var sort_by = value.slice(1);
      // only accept certain fields
      switch (sort_by) {
        case 'dateStarted':
        case 'dateCompleted':
        case 'author':
          sort[sort_by] = order_by;
          break;
      }
    }, this);
  }

  // Set query type
  _.assignIn(query, { "_schemaName": "CommentPeriod" });

  var data = await Utils.runDataQuery('CommentPeriod',
    ['public'],
    query,
    getSanitizedFields(args.swagger.params.fields.value), // Fields
    null, // sort warmup
    sort, // sort
    null, // skip
    null, // limit
    false) // count
  return Actions.sendResponse(res, 200, data);
};

exports.protectedHead = async function (args, res, next) {
  defaultLog.info("args.swagger.params:", args.swagger.operation["x-security-scopes"]);

  // Build match query if on CommentPeriodId route
  var query = {};
  if (args.swagger.params.commentPeriodId && args.swagger.params.commentPeriodId.value) {
    query = Utils.buildQuery("_id", args.swagger.params.commentPeriodId.value, query);
  }
  if (args.swagger.params.project && args.swagger.params.project.value) {
    query = Utils.buildQuery("project", args.swagger.params.project.value, query);
  }
  // Unless they specifically ask for it, hide deleted results.
  if (args.swagger.params.isDeleted && args.swagger.params.isDeleted.value != undefined) {
    _.assignIn(query, { isDeleted: args.swagger.params.isDeleted.value });
  } else {

  }
  // Set query type
  _.assignIn(query, { "_schemaName": "CommentPeriod" });

  var data = await Utils.runDataQuery('CommentPeriod',
    args.swagger.params.auth_payload.realm_access.roles,
    query,
    ['_id',
      'tags'], // Fields
    null, // sort warmup
    null, // sort
    null, // skip
    null, // limit
    true) // count
  // /api/commentperiod/ route, return 200 OK with 0 items if necessary
  if (!(args.swagger.params.commentPeriodId && args.swagger.params.commentPeriodId.value) || (data && data.length > 0)) {
    res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items : 0);
    return Actions.sendResponse(res, 200, data);
  } else {
    return Actions.sendResponse(res, 404, data);
  }
}

exports.protectedGet = async function (args, res, next) {

  defaultLog.info("args.swagger.params:", args.swagger.operation["x-security-scopes"]);

  // Build match query if on CommentPeriodId route
  var query = {}, sort = {};
  if (args.swagger.params.commentPeriodId) {
    query = Utils.buildQuery("_id", args.swagger.params.commentPeriodId.value, query);
  }
  if (args.swagger.params.project && args.swagger.params.project.value) {
    _.assignIn(query, { project: mongoose.Types.ObjectId(args.swagger.params.project.value) });
  }
  if (args.swagger.params.sortBy && args.swagger.params.sortBy.value) {
    args.swagger.params.sortBy.value.forEach(function (value) {
      var order_by = value.charAt(0) == '-' ? -1 : 1;
      var sort_by = value.slice(1);
      // only accept certain fields
      switch (sort_by) {
        case 'dateStarted':
        case 'dateCompleted':
        case 'author':
          sort[sort_by] = order_by;
          break;
      }
    }, this);
  }

  var processedParameters = Utils.getSkipLimitParameters(args.swagger.params.pageSize, args.swagger.params.pageNum);
  skip = processedParameters.skip;
  limit = processedParameters.limit;

  // Set query type
  _.assignIn(query, { "_schemaName": "CommentPeriod" });

  var data = await Utils.runDataQuery('CommentPeriod',
    args.swagger.params.auth_payload.realm_access.roles,
    query,
    getSanitizedFields(args.swagger.params.fields.value), // Fields
    null, // sort warmup
    sort, // sort
    skip, // skip
    limit, // limit
    true) // count
  return Actions.sendResponse(res, 200, data);
};

//  Create a new CommentPeriod
exports.protectedPost = async function (args, res, next) {
  var obj = args.swagger.params._commentPeriod.value;
  defaultLog.info("Incoming new object:", obj);
  defaultLog.info("args.swagger.params.auth_payload:", args.swagger.params.auth_payload);
  obj._addedBy = args.swagger.params.auth_payload.preferred_username.value;

  var CommentPeriod = mongoose.model('CommentPeriod');
  var commentperiod = new CommentPeriod(obj);

  // Define security tag defaults
  commentperiod.tags = [['sysadmin']];
  commentperiod._addedBy = args.swagger.params.auth_payload.preferred_username;
  var c = await commentperiod.save()
  // defaultLog.info("Saved new CommentPeriod object:", c);
  return Actions.sendResponse(res, 200, c);
};

// Update an existing CommentPeriod
exports.protectedPut = function (args, res, next) {
  var objId = args.swagger.params.commentPeriodId.value;
  defaultLog.info("ObjectID:", args.swagger.params.commentPeriodId.value);
  var obj = args.swagger.params.cp.value;

  // Strip security tags - these will not be updated on this route.
  delete obj.tags;

  delete obj._addedBy;

  defaultLog.info("Incoming updated object:", obj);
  // TODO sanitize/update audits.

  var commentperiod = require('mongoose').model('CommentPeriod');
  commentperiod.findOneAndUpdate({ _id: objId }, obj, { upsert: false, new: true }, function (err, o) {
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
exports.protectedDelete = async function (args, res, next) {
  var objId = args.swagger.params.commentPeriodId.value;
  defaultLog.info("Delete CommentPeriod:", objId);

  var commentperiod = require('mongoose').model('CommentPeriod');
  commentperiod.findOne({ _id: objId, isDeleted: false }, async function (err, o) {
    if (o) {
      defaultLog.info("o:", o);

      // Set the deleted flag.
      var deleted = await Actions.delete(o)
      // Deleted successfully
      return Actions.sendResponse(res, 200, deleted);
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
};

// Publish/Unpublish the CommentPeriod
exports.protectedPublish = async function (args, res, next) {
  var objId = args.swagger.params.commentPeriodId.value;
  defaultLog.info("Publish CommentPeriod:", objId);

  var commentperiod = require('mongoose').model('CommentPeriod');
  commentperiod.findOne({ _id: objId }, async function (err, o) {
    if (o) {
      defaultLog.info("o:", o);

      // Add public to the tag of this obj.
      var published = await Actions.publish(o)
      // Published successfully
      return Actions.sendResponse(res, 200, published);
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
};

exports.protectedUnPublish = async function (args, res, next) {
  var objId = args.swagger.params.commentPeriodId.value;
  defaultLog.info("UnPublish CommentPeriod:", objId);

  var commentperiod = require('mongoose').model('CommentPeriod');
  commentperiod.findOne({ _id: objId }, async function (err, o) {
    if (o) {
      defaultLog.info("o:", o);

      // Remove public to the tag of this obj.
      var unpublished = await Actions.unPublish(o)
      // UnPublished successfully
      return Actions.sendResponse(res, 200, unpublished);
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
};
