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
  defaultLog.info('Public get for comment period');

  // Build match query if on CommentPeriodId route
  var query = {}, sort = {};

  if (args.swagger.params.commentPeriodId) {
    query = Utils.buildQuery('_id', args.swagger.params.commentPeriodId.value, query);
  }
  if (args.swagger.params.project && args.swagger.params.project.value) {
    query = Utils.buildQuery('project', args.swagger.params.project.value, query);
  }

  // sort
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
  _.assignIn(query, { '_schemaName': 'CommentPeriod' });

  try {
    var data = await Utils.runDataQuery('CommentPeriod',
      ['public'],
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null, // sort warmup
      sort, // sort
      null, // skip
      null, // limit
      false); // count

    Utils.recordAction('get', 'commentPeriod', args.swagger.params.auth_payload.preferred_username);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedHead = async function (args, res, next) {
  defaultLog.info('Head for comment period');

  // Build match query if on CommentPeriodId route
  var query = {};
  if (args.swagger.params.commentPeriodId && args.swagger.params.commentPeriodId.value) {
    query = Utils.buildQuery('_id', args.swagger.params.commentPeriodId.value, query);
  }
  if (args.swagger.params.project && args.swagger.params.project.value) {
    query = Utils.buildQuery('project', args.swagger.params.project.value, query);
  }
  // Unless they specifically ask for it, hide deleted results.
  if (args.swagger.params.isDeleted && args.swagger.params.isDeleted.value != undefined) {
    _.assignIn(query, { isDeleted: args.swagger.params.isDeleted.value });
  }

  // Set query type
  _.assignIn(query, { '_schemaName': 'CommentPeriod' });

  try {
    var data = await Utils.runDataQuery('CommentPeriod',
      args.swagger.params.auth_payload.realm_access.roles,
      query,
      ['_id', 'read', 'write', 'delete'], // Fields
      null, // sort warmup
      null, // sort
      null, // skip
      null, // limit
      true); // count

    Utils.recordAction('head', 'commentPeriod', args.swagger.params.auth_payload.preferred_username);

    // /api/commentperiod/ route, return 200 OK with 0 items if necessary
    if (!(args.swagger.params.commentPeriodId && args.swagger.params.commentPeriodId.value) || (data && data.length > 0)) {
      res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items : 0);
      return Actions.sendResponse(res, 200, data);
    } else {
      return Actions.sendResponse(res, 404, data);
    }
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
}

exports.protectedGet = async function (args, res, next) {
  defaultLog.info('Getting comment period(s)');

  // Build match query if on CommentPeriodId route
  var query = {}, sort = {}, count = false;
  if (args.swagger.params.commentPeriodId) {
    defaultLog.info('Comment period id:', args.swagger.params.commentPeriodId.value);
    query = Utils.buildQuery('_id', args.swagger.params.commentPeriodId.value, query);
  }

  // Build match query if on project's id
  if (args.swagger.params.project && args.swagger.params.project.value) {
    _.assignIn(query, { project: mongoose.Types.ObjectId(args.swagger.params.project.value)});
  }

  // sort
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

  // skip and limit
  var processedParameters = Utils.getSkipLimitParameters(args.swagger.params.pageSize, args.swagger.params.pageNum);
  skip = processedParameters.skip;
  limit = processedParameters.limit;

  // count
  if (args.swagger.params.count && args.swagger.params.count.value) {
    count = args.swagger.params.count.value;
  }

  // Set query type
  _.assignIn(query, { '_schemaName': 'CommentPeriod' });

  try {
    var data = await Utils.runDataQuery('CommentPeriod',
      args.swagger.params.auth_payload.realm_access.roles,
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null,   // sort warmup
      sort,   // sort
      skip,   // skip
      limit,  // limit
      count); // count
    Utils.recordAction('get', 'commentPeriod', args.swagger.params.auth_payload.preferred_username);
    defaultLog.info('Got comment period(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

//  Create a new CommentPeriod
exports.protectedPost = async function (args, res, next) {
  var obj = args.swagger.params.period.value;

  defaultLog.info('Incoming new comment period:', obj);

  var CommentPeriod = mongoose.model('CommentPeriod');

  var commentPeriod = new CommentPeriod({
    _schemaName: 'CommentPeriod',
    addedBy: args.swagger.params.auth_payload.preferred_username.value,
    dateAdded: new Date(),
    dateCompleted: obj.dateCompleted,
    dateStarted: obj.dateStarted,
    instructions: obj.instructions,
    milestones: obj.milestones,
    openHouses: obj.openHouses,
    project: mongoose.Types.ObjectId(obj.project),
    read: obj.read,
    write: obj.write,
    delete: obj.delete
  });

  try {
    var cp = await commentPeriod.save();
    Utils.recordAction('put', 'commentPeriod', args.swagger.params.auth_payload.preferred_username, cp._id);
    defaultLog.info('Saved new comment period object:', cp);
    return Actions.sendResponse(res, 200, cp);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

// Update an existing CommentPeriod
exports.protectedPut = async function (args, res, next) {
  var objId = args.swagger.params.commentPeriodId.value;
  var obj = args.swagger.params.cp.value;
  defaultLog.info('Put comment period:', objId);

  delete obj.__v;

  obj.updatedBy = args.swagger.params.auth_payload.preferred_username.value;
  obj.dateUpdated = new Date();

  defaultLog.info('Incoming updated object:', obj);

  var CommentPeriod = mongoose.model('CommentPeriod');
  try {
    var commentPeriod = await CommentPeriod.findOneAndUpdate({ _id: objId }, obj, { upsert: false });
    Utils.recordAction('put', 'commentPeriod', args.swagger.params.auth_payload.preferred_username, objId);
    defaultLog.info('Comment period updated:', commentPeriod);
    return Actions.sendResponse(res, 200, commentPeriod);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
}

//  Delete a new CommentPeriod
exports.protectedDelete = async function (args, res, next) {
  var objId = args.swagger.params.commentPeriodId.value;
  defaultLog.info('Delete comment period:', objId);

  var CommentPeriod = mongoose.model('CommentPeriod');
  try {
    await CommentPeriod.findOneAndRemove({ _id: objId });
    Utils.recordAction('delete', 'commentPeriod', args.swagger.params.auth_payload.preferred_username, objId);
    return Actions.sendResponse(res, 200, {});
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

// Publish/Unpublish the CommentPeriod
exports.protectedPublish = async function (args, res, next) {
  var objId = args.swagger.params.commentPeriodId.value;
  defaultLog.info('Publish comment period:', objId);

  var CommentPeriod = mongoose.model('CommentPeriod');
  try {
    var commentPeriod = await CommentPeriod.findOne({ _id: objId });
    delete commentPeriod.__v;
    defaultLog.info('Comment period object:', commentPeriod);
    // Add public to read array.
    var published = await Actions.publish(commentPeriod);
    Utils.recordAction('publish', 'commentPeriod', args.swagger.params.auth_payload.preferred_username, objId);
    return Actions.sendResponse(res, 200, published);
  } catch (e) {
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedUnPublish = async function (args, res, next) {
  var objId = args.swagger.params.commentPeriodId.value;
  defaultLog.info('UnPublish comment period:', objId);

  var CommentPeriod = mongoose.model('CommentPeriod');
  try {
    var commentPeriod = await CommentPeriod.findOne({ _id: objId });
    delete commentPeriod.__v;
    defaultLog.info('Comment period object:', commentPeriod);
    // Remove public from read array.
    var unpublished = await Actions.unPublish(commentPeriod);
    Utils.recordAction('unPublish', 'commentPeriod', args.swagger.params.auth_payload.preferred_username, objId);
    return Actions.sendResponse(res, 200, unpublished);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};
