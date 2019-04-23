var auth = require('../helpers/auth');
var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');

var getSanitizedFields = function (fields) {
  return _.remove(fields, function (f) {
    return (_.indexOf([
      'author',
      'comment',
      'commentId',
      'dateAdded',
      'dateUpdated',
      'eaoNotes',
      'eaoStatus',
      'isAnonymous',
      'location',
      'period',
      'proponentNotes',
      'proponentStatus',
      'publishedNotes',
      'rejectedNotes',
      'rejectedReason',
      'valuedComponents',
      'read',
      'write',
      'delete'
    ], f) !== -1);
  });
}

var setPermissionsFromEaoStatus = function (status, comment) {
  switch (status) {
    case 'publish':
      defaultLog.info('Publishing Comment:', objId);
      comment.eaoStatus = 'Published';
      comment.read = ['public', 'staff', 'sysadmin'];
      break;
      case 'defer':
      defaultLog.info('Deferring Comment:', objId);
      comment.eaoStatus = 'Deferred';
      comment.read = ['staff', 'sysadmin'];
      break;
      case 'reject':
      defaultLog.info('Rejecting Comment:', objId);
      comment.eaoStatus = 'Rejected';
      comment.read = ['staff', 'sysadmin'];
      break;
    case 'Reset':
      defaultLog.info('Reseting Comment Status:', objId);
      comment.eaoStatus = '';
      comment.read = ['staff', 'sysadmin'];
      break;
    default:
      break;
  }
}

// Function 'warms up' the query so that we can project the field that we're sorting on
// extract 'contactName' and lower-case it
var sortWarmUp = function (sort, fields) {
  if (sort) {
    var projection = {};
    _.each(fields, function (f) {
      projection[f] = 1;
    });
    return sort.contactName ? { $project: Object.assign({ contactName: { $toLower: '$commentAuthor.contactName' } }, projection) } : null;
  }
  return null;
}

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
};

exports.publicHead = async function (args, res, next) {
  defaultLog.info('args.swagger.params:', args.swagger.operation['x-security-scopes']);

  // Build match query if on CommentPeriodId route
  var query = {};
  if (args.swagger.params.period && args.swagger.params.period.value) {
    query = Utils.buildQuery('period', args.swagger.params.period.value, query);
  }

  const fields = getSanitizedFields(args.swagger.params.fields.value);

  // Set query type
  _.assignIn(query, { '_schemaName': 'Comment' });

  var data = await Utils.runDataQuery('Comment',
    ['public'],
    query,
    fields, // Fields
    null, // sort warmup
    null, // sort
    null, // skip
    null, // limit
    true); // count
  // /api/comment/ route, return 200 OK with 0 items if necessary
  if (!(args.swagger.params.period && args.swagger.params.period.value) || (data && data.length > 0)) {
    res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items : 0);
    return Actions.sendResponse(res, 200, data);
  }
};

exports.publicGet = async function (args, res, next) {
  var query = {}, sort = {};
  var skip = null, limit = null;

  // Build match query if on commentId route.
  if (args.swagger.params.commentId && args.swagger.params.commentId.value) {
    query = Utils.buildQuery('_id', args.swagger.params.commentId.value, query);
  } else {
    if (args.swagger.params.period && args.swagger.params.period.value) {
      query = Utils.buildQuery('period', args.swagger.params.period.value, query);
    }
    if (args.swagger.params.sortBy && args.swagger.params.sortBy.value) {
      args.swagger.params.sortBy.value.forEach(function (value) {
        var order_by = value.charAt(0) == '-' ? -1 : 1;
        var sort_by = value.slice(1);
        // only accept certain fields
        switch (sort_by) {
          case 'dateAdded':
          case 'author':
            sort[sort_by] = order_by;
            break;
        }
      }, this);
    }

    var processedParameters = Utils.getSkipLimitParameters(args.swagger.params.pageSize, args.swagger.params.pageNum);
    skip = processedParameters.skip;
    limit = processedParameters.limit;
  }

  const fields = getSanitizedFields(args.swagger.params.fields.value);
  // Set query type
  _.assignIn(query, { '_schemaName': 'Comment' });

  var data = await Utils.runDataQuery('Comment',
    ['public'],
    query,
    fields, // Fields
    null,
    sort, // sort
    skip, // skip
    limit, // limit
    args.swagger.params.count.value); // count
  if (args.swagger.params.count.value) {
    res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items : 0);
    return Actions.sendResponse(res, 200, data.length !== 0 ? data[0].results : []);
  } else {
    return Actions.sendResponse(res, 200, data);
  }
};

exports.protectedHead = async function (args, res, next) {
  var skip = null, limit = null;
  var sort = {}, query = {};

  if (args.swagger.params.commentId && args.swagger.params.commentId.value) {
    query = Utils.buildQuery('_id', args.swagger.params.commentId.value, query);
  }
  if (args.swagger.params._commentPeriod && args.swagger.params._commentPeriod.value) {
    query = Utils.buildQuery('_commentPeriod', args.swagger.params._commentPeriod.value, query);
  }
  // Unless they specifically ask for it, hide deleted results.
  if (args.swagger.params.isDeleted && args.swagger.params.isDeleted.value != undefined) {
    _.assignIn(query, { isDeleted: args.swagger.params.isDeleted.value });
  } else {

  }
  // Set query type
  _.assignIn(query, { '_schemaName': 'Comment' });

  var data = await Utils.runDataQuery('Comment',
    args.swagger.operation['x-security-scopes'],
    query,
    ['_id',
      'tags'], // Fields
    null, // sort warmup
    null, // sort
    null, // skip
    null, // limit
    true); // count
  // /api/comment/ route, return 200 OK with 0 items if necessary
  if (!(args.swagger.params.commentId && args.swagger.params.commentId.value) || (data && data.length > 0)) {
    res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items : 0);
    return Actions.sendResponse(res, 200, data);
  } else {
    return Actions.sendResponse(res, 404, data);
  }
};

exports.protectedGet = async function (args, res, next) {
  defaultLog.info('Getting comment(s)')

  var query = {}, sort = {}, skip = null, limit = null, count = false, filter = [];

  // Build match query if on commentId route.
  if (args.swagger.params.commentId && args.swagger.params.commentId.value) {
    _.assignIn(query, { _id: mongoose.Types.ObjectId(args.swagger.params.commentId.value) });
  }

  // Build match query if on comment period's id
  if (args.swagger.params.period && args.swagger.params.period.value) {
    _.assignIn(query, { period: mongoose.Types.ObjectId(args.swagger.params.period.value) });
  }

  // Sort
  if (args.swagger.params.sortBy && args.swagger.params.sortBy.value) {
    args.swagger.params.sortBy.value.forEach(function (value) {
      var order_by = value.charAt(0) == '-' ? -1 : 1;
      var sort_by = value.slice(1);
      sort[sort_by] = order_by;
    }, this);
  }

  // Skip and limit
  var processedParameters = Utils.getSkipLimitParameters(args.swagger.params.pageSize, args.swagger.params.pageNum);
  skip = processedParameters.skip;
  limit = processedParameters.limit;

  // Count
  if (args.swagger.params.count && args.swagger.params.count.value) {
    count = args.swagger.params.count.value;
  }

  // Set query type
  _.assignIn(query, { '_schemaName': 'Comment' });

  // Set filter for eaoStatus
  if (args.swagger.params.pending && args.swagger.params.pending.value === true) {
    filter.push({ 'eaoStatus': 'Pending' });
  }
  if (args.swagger.params.published && args.swagger.params.published.value === true) {
    filter.push({ 'eaoStatus': 'Published' });
  }
  if (args.swagger.params.deferred && args.swagger.params.deferred.value === true) {
    filter.push({ 'eaoStatus': 'Deferred' });
  }
  if (args.swagger.params.rejected && args.swagger.params.rejected.value === true) {
    filter.push({ 'eaoStatus': 'Rejected' });
  }
  if (filter.length !== 0) {
    _.assignIn(query, { $or: filter });
  }

  try {
    var data = await Utils.runDataQuery('Comment',
      args.swagger.params.auth_payload.realm_access.roles,
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null,
      sort, // sort
      skip, // skip
      limit, // limit
      count); // count
    Utils.recordAction('get', 'comment', args.swagger.params.auth_payload.preferred_username);
    defaultLog.info('Got comment(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

//  Create a new Comment
exports.unProtectedPost = async function (args, res, next) {
  var obj = args.swagger.params.comment.value;
  defaultLog.info('Incoming new object:', obj);

  var Comment = mongoose.model('Comment');
  var comment = new Comment(obj);

  comment.commentStatus = 'Pending';
  comment.dateAdded = Date.now();

  // Define security tag defaults
  comment.tags = [['sysadmin']];
  comment.review.tags = [['sysadmin']];
  comment.commentAuthor.tags = [['sysadmin']];

  // Unless they request to be anon, make their stuff public.
  // TODO: Contact name/location/org currently showing public
  // when they request anonymous.
  if (!comment.commentAuthor.requestedAnonymous) {
    comment.commentAuthor.tags = [['sysadmin'], ['public']];
  }

  // Never allow this to be updated
  comment.commentAuthor.internal.tags = [['sysadmin']];

  // Not needed until we tie user profiles in.
  // comment._addedBy = args.swagger.params.auth_payload.preferred_username;

  var c = await comment.save()
  // defaultLog.info('Saved new Comment object:', c);
  return Actions.sendResponse(res, 200, c);
};

// Update an existing Comment
exports.protectedPut = async function (args, res, next) {
  var objId = args.swagger.params.commentId.value;
  var obj = args.swagger.params.comment.value;
  defaultLog.info('Put comment:', objId);

  var Comment = mongoose.model('Comment');

  var vcs = [];
  obj.valuedComponents.forEach(function(vc) {
    vcs.push(mongoose.Types.ObjectId(vc));
  });

  var comment = {
    dateUpdated: new Date(),
    eaoNotes: obj.eaoNotes,
    eaoStatus: obj.eaoStatus,
    proponentNotes: obj.proponentNotes,
    proponentStatus: obj.proponentStatus,
    publishedNotes: obj.publishedNotes,
    rejectedNotes: obj.rejectedNotes,
    rejectedReason: obj.rejectedReason,
    valuedComponents: vcs,
    // TODO
    // documents: obj.documents,
    updatedBy: args.swagger.params.auth_payload.preferred_username
  };
  setPermissionsFromEaoStatus(obj.eaoStatus, comment);

  defaultLog.info('Incoming updated object:', comment);

  try {
    var c = await Comment.findOneAndUpdate({ _id: objId }, comment, { upsert: false });
    Utils.recordAction('put', 'comment', args.swagger.params.auth_payload.preferred_username, objId);
    defaultLog.info('Comment updated:', c);
    return Actions.sendResponse(res, 200, c);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

// Publish the Comment
exports.protectedStatus = async function (args, res, next) {
  var objId = args.swagger.params.commentId.value;
  var status = args.swagger.params.status.value.status;

  var comment = {
    dateUpdated: new Date(),
    updatedBy: args.swagger.params.auth_payload.preferred_username
  }
  var Comment = mongoose.model('Comment');

  setPermissionsFromEaoStatus(status, comment);

  try {
    var c = await Comment.findOneAndUpdate({ _id: objId }, comment, { upsert: false, new: true }).exec();
    Utils.recordAction('put', 'comment', args.swagger.params.auth_payload.preferred_username, objId);
    defaultLog.info('Comment updated:', c);
    return Actions.sendResponse(res, 200, c);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }

  // var Comment = require('mongoose').model('Comment');
  // Comment.findOne({ _id: objId }, async function (err, o) {
  //   if (o) {
  //     defaultLog.info('o:', o);

  //     // Add public to the tag of this obj.
  //     var published = await Actions.publish(o);
  //     // Published successfully
  //     return Actions.sendResponse(res, 200, published);
  //   } else {
  //     defaultLog.info('Couldn\'t find that object!');
  //     return Actions.sendResponse(res, 404, {});
  //   }
  // });
};
