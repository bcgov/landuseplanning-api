var auth = require('../helpers/auth');
var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');

/**
 * 
 * Shared options 
 */

var getSanitizedFields = function (fields) {
  return _.remove(fields, function (f) {
    return (_.indexOf([
      'email',
      'project',
      'confirmed',
      'dateSubscribed',
      'dateConfirmed',
      'read',
      'write',
      'delete'
    ], f) !== -1);
  });
}

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

/**
 * Public
 */

exports.publicHead = async function (args, res, next) {
  defaultLog.info('args.swagger.params:', args.swagger.operation['x-security-scopes']);

  const fields = getSanitizedFields(args.swagger.params.fields.value);

  // Set query type
  _.assignIn(query, { '_schemaName': 'EmailSubscribe' });

  var data = await Utils.runDataQuery('EmailSubscribe',
    ['public'],
    query,
    fields, // Fields
    null, // sort warmup
    null, // sort
    null, // skip
    null, // limit
    true); // count
  Utils.recordAction('Head', 'EmailSubscribe', 'public');
  // /api/comment/ route, return 200 OK with 0 items if necessary
  //if (!(args.swagger.params.period && args.swagger.params.period.value) || (data && data.length > 0)) {
    res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items : 0);
    return Actions.sendResponse(res, 200, data);
  //}
};

// subscribe a new email address
exports.unProtectedPost = async function (args, res, next) {
  var obj = args.swagger.params.emailSubscribe.value;
  defaultLog.info('Incoming new object:', obj);
  var existingEmailId, existingProject;
  var isDuplicate = false;

  var EmailSubscribe = mongoose.model('EmailSubscribe');

  var emailSubscribe = new EmailSubscribe(obj);
  emailSubscribe._schemaName = 'EmailSubscribe';
  emailSubscribe.email = obj.email;
  emailSubscribe.project = [mongoose.Types.ObjectId(obj.project)];
  emailSubscribe.confirmed = false;
  emailSubscribe.dateSubscribed = new Date();
  emailSubscribe.dateConfirmed = null;
  emailSubscribe.read = ['staff', 'sysadmin'];
  emailSubscribe.write = ['staff', 'sysadmin'];
  emailSubscribe.delete = ['staff', 'sysadmin'];

  // check if already exists
  // if so either update with the new project or exit graacefully
  await EmailSubscribe.findOne({ email: emailSubscribe.email }, null, async function (err, entity) {
    if (entity) {
      existingEmailId = entity._id;
      existingProjectArray = entity.project;
      // check if pushed project is in array
      if (existingProjectArray.includes(mongoose.Types.ObjectId(obj.project)) ) {
        isDuplicate = true;
      }
    }
  });

  if (existingEmailId && isDuplicate ) {
    // Project and email already exists so exit gracefully
    defaultLog.info('User has already signed up for the project', existingEmailId);
    return Actions.sendResponse(res, 200, '200');
  } else if (existingEmailId) {
    // New project for an existing email
    existingProjectArray.push(mongoose.Types.ObjectId(obj.project));
    var es = await EmailSubscribe.update({ _id: existingEmailId }, { $set: { project: existingProjectArray } });
    Utils.recordAction('Put', 'EmailSubscribe', 'public', emailSubscribe.email);
    defaultLog.info('New project added to email subscribe:', es);
    return Actions.sendResponse(res, 200, es);
  }
 
  try {
    var c = await emailSubscribe.save();
    Utils.recordAction('Post', 'EmailSubscribe', 'public', c._id);
    defaultLog.info('Saved new EmailSubscribe object:', c);
    return Actions.sendResponse(res, 200, c);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

// confirm a new email address
exports.unProtectedPut = async function (args, res, next) {
  console.log('ES Put', args.swagger.params);

  // verify that the email and key have been set in the request
  if (!(args.swagger.params.email && args.swagger.params.email.value) || !(args.swagger.params.confirmKey && args.swagger.params.confirmKey.value)) {
    return Actions.sendResponse(res, 403, 'Access denied');
  } else {
    //return Actions.sendResponse(res, 200, 'ok');
  }
  
  var emailAddress = args.swagger.params.email.value;
  var confirmKey = args.swagger.params.confirmKey.value;
  var emailId, correctConfirmKey, confirmDate, previousConfirmed;
  defaultLog.info('Put email subscribe:', emailAddress);

  var EmailSubscribe = mongoose.model('EmailSubscribe');

  // find the object ID based on the email address
  await EmailSubscribe.findOne({ email: emailAddress }, null, function (err, entity) {
    console.log('Err', err);
    console.log('Entity', entity);
    try {
      emailId = entity._id;
      correctConfirmKey = entity.confirmKey;
      confirmDate = new Date();
      previousConfirmed = entity.confirmed;
    } catch(e) {
      defaultLog.info('Error:', e);
      return Actions.sendResponse(res, 404, e);
    }
  });

  // check if the auth key is valid, else respond with a 403
  if ( correctConfirmKey !== confirmKey) {
    return Actions.sendResponse(res, 403, 'Access denied');
  }

  // check if it has already been confirmed. If so, gracefully exit with a 200
  if (previousConfirmed) {
    defaultLog.info('Email has already been confirmed:', emailAddress);
    return Actions.sendResponse(res, 200, {});
  }

  var emailSubscribe = {
    confirmed: true,
    dateConfirmed: confirmDate,
  };

  defaultLog.info('Incoming updated object:', emailSubscribe);

  try {
    
    var es = await EmailSubscribe.update({ _id: emailId }, { $set: emailSubscribe });
    Utils.recordAction('Put', 'EmailSubscribe', 'public', emailAddress);
    defaultLog.info('Email confirmed:', es);
    return Actions.sendResponse(res, 200, es);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
}

// unsubscribe from ubdates
exports.unProtectedDelete = async function (args, res, next) {
  console.log('ES Delete', args.swagger.params);

  // verify that the email and key have been set in the request
  if (!(args.swagger.params.email && args.swagger.params.email.value)) {
    return Actions.sendResponse(res, 404, 'Not found');
  }

  var emailAddress = args.swagger.params.email.value;
  var emailId;
  defaultLog.info('Delete email subscribe:', emailAddress);

  var EmailSubscribe = mongoose.model('EmailSubscribe');

  // find the object ID based on the email address
  await EmailSubscribe.findOne({ email: emailAddress }, null, function (err, entity) {
    try {
      emailId = entity._id;
    } catch (e) {
      defaultLog.info('Error:', e);
      return Actions.sendResponse(res, 404, e);
    }
  });

  try {

    var es = await EmailSubscribe.findOneAndRemove({ _id: emailId });
    Utils.recordAction('Delete', 'EmailSubscribe', 'public', emailAddress);
    defaultLog.info('Email unsubscribed:', es);
    return Actions.sendResponse(res, 200, es);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
}

/**
 * Admin
 */

// get list of subscribers

exports.protectedHead = async function (args, res, next) {
  var skip = null, limit = null;
  var sort = {}, query = {};

  if (args.swagger.params.email && args.swagger.params.email.value) {
    query = Utils.buildQuery('_id', args.swagger.params.email.value, query);
  }

  // Set query type
  _.assignIn(query, { '_schemaName': 'EmailSubscribe' });

  var data = await Utils.runDataQuery('EmailSubscribe',
    args.swagger.operation['x-security-scopes'],
    query,
    ['_id',
      'tags'], // Fields
    null, // sort warmup
    null, // sort
    null, // skip
    null, // limit
    true); // count
  Utils.recordAction('Head', 'EmailSubscribe', args.swagger.params.auth_payload.preferred_username, args.swagger.params.email && args.swagger.params.email.value ? args.swagger.params.email.value : null);
  // /api/comment/ route, return 200 OK with 0 items if necessary
  if (!(args.swagger.params.email && args.swagger.params.email.value) || (data && data.length > 0)) {
    res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items : 0);
    return Actions.sendResponse(res, 200, data);
  } else {
    return Actions.sendResponse(res, 404, data);
  }
};

exports.protectedGet = async function (args, res, next) {
  defaultLog.info('Getting email subscribers')

  var query = {}, sort = {}, skip = null, limit = null, count = false, filter = [];

  // Build match query if on email route.
  /*
  if (args.swagger.params.email && args.swagger.params.email.value) {
    _.assignIn(query, { _id: mongoose.Types.ObjectId(args.swagger.params.email.value) });
  }*/

  // Build match query if on comment period's id
  // *** Update to project match
  /*
  if (args.swagger.params.period && args.swagger.params.period.value) {
    _.assignIn(query, { period: mongoose.Types.ObjectId(args.swagger.params.period.value) });
  }*/

  // Build match query for project ID
  if (args.swagger.params.project && args.swagger.params.project.value) {
    console.log('ES Project ID', args.swagger.params.project.value);
    _.assignIn(query, { project: mongoose.Types.ObjectId(args.swagger.params.project.value) });
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

  //query = addStandardQueryFilters(query, args);

  // Set query type
  _.assignIn(query, { '_schemaName': 'EmailSubscribe' });

  // Set filter for eaoStatus
  /*if (args.swagger.params.pending && args.swagger.params.pending.value === true) {
    filter.push({ 'eaoStatus': 'Pending' });
  }*/
  if (filter.length !== 0) {
    _.assignIn(query, { $or: filter });
  }

  try {
    var data = await Utils.runDataQuery('EmailSubscribe',
      args.swagger.params.auth_payload.realm_access.roles,
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null,
      sort, // sort
      skip, // skip
      limit, // limit
      count); // count
    //Utils.recordAction('Get', 'EmailSubscribe', args.swagger.params.auth_payload.preferred_username, args.swagger.params.email && args.swagger.params.email.value ? args.swagger.params.email.value : null);
    defaultLog.info('Got email subscribers:', data);

    // This is to get the next pending comment information.
    /*
    if (args.swagger.params.populateNextComment && args.swagger.params.populateNextComment.value) {
      defaultLog.info('Getting next pending comment information');
      var queryForNextComment = {};

      _.assignIn(queryForNextComment, { _id: { $ne: data[0]._id } });
      _.assignIn(queryForNextComment, { period: data[0].period });
      _.assignIn(queryForNextComment, { eaoStatus: 'Pending' });

      var nextComment = await Utils.runDataQuery('Comment',
        args.swagger.params.auth_payload.realm_access.roles,
        queryForNextComment,
        [], // Fields
        null,
        { commentId: 1 }, // sort
        0, // skip
        1, // limit
        true); // count
      res.setHeader('x-pending-comment-count', nextComment && nextComment.length > 0 ? nextComment[0].total_items : 0);
      res.setHeader('x-next-comment-id', nextComment && nextComment.length > 0 && nextComment[0].results.length > 0 ? nextComment[0].results[0]._id : null);
    }*/
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};