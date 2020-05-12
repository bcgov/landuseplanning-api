var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');

var getSanitizedFields = function (fields) {
  return _.remove(fields, function (f) {
    return (_.indexOf([
      '_schemaName',
      'name',
      'lastSaved',
      'dateAdded',
      'project',
      'commentPeriod',
      'questions',

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
  defaultLog.info('Public get for survey questions');

  const CommentPeriod = mongoose.model('CommentPeriod');

  // Build match query if on SurveyId route
  var query = {}, sort = {};

  if (args.swagger.params.surveyId && args.swagger.params.surveyId.value) {
    query = Utils.buildQuery('_id', args.swagger.params.surveyId.value, query);
  }
  if (args.swagger.params.project && args.swagger.params.project.value) {
    query = Utils.buildQuery('project', args.swagger.params.project.value, query);
  }
  if (args.swagger.params.commentPeriod && args.swagger.params.commentPeriod.value) {
    await CommentPeriod.findById(args.swagger.params.commentPeriod.value)
    .exec()
    .then(cp => {
        query = Utils.buildQuery('_id', cp.surveySelected, query);
    })
  }

  // sort
  if (args.swagger.params.sortBy && args.swagger.params.sortBy.value) {
    // args.swagger.params.sortBy.value.forEach(function (value) {
    //   var order_by = value.charAt(0) == '-' ? -1 : 1;
    //   var sort_by = value.slice(1);
    //   // only accept certain fields
    //   switch (sort_by) {
    //     case 'dateStarted':
    //     case 'dateCompleted':
    //     case 'author':
    //       sort[sort_by] = order_by;
    //       break;
    //   }
    // }, this);
  }

  // Set query type
  _.assignIn(query, { '_schemaName': 'Survey' });

  try {
    var data = await Utils.runDataQuery('Survey',
      ['public'],
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null, // sort warmup
      sort, // sort
      null, // skip
      null, // limit
      false); // count


    console.log('survey controller:', 'here is the returned data', data)
    Utils.recordAction('Get', 'Survey', 'public', args.swagger.params.surveyId && args.swagger.params.surveyId.value ? args.swagger.params.surveyId.value : null);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

// exports.protectedHead = async function (args, res, next) {
//   defaultLog.info('Head for comment period');

//   // Build match query if on CommentPeriodId route
//   var query = {};
//   if (args.swagger.params.commentPeriodId && args.swagger.params.commentPeriodId.value) {
//     query = Utils.buildQuery('_id', args.swagger.params.commentPeriodId.value, query);
//   }
//   if (args.swagger.params.project && args.swagger.params.project.value) {
//     query = Utils.buildQuery('project', args.swagger.params.project.value, query);
//   }
//   // Unless they specifically ask for it, hide deleted results.
//   if (args.swagger.params.isDeleted && args.swagger.params.isDeleted.value != undefined) {
//     _.assignIn(query, { isDeleted: args.swagger.params.isDeleted.value });
//   }

//   // Set query type
//   _.assignIn(query, { '_schemaName': 'CommentPeriod' });

//   try {
//     var data = await Utils.runDataQuery('CommentPeriod',
//       args.swagger.params.auth_payload.realm_access.roles,
//       query,
//       ['_id', 'read', 'write', 'delete'], // Fields
//       null, // sort warmup
//       null, // sort
//       null, // skip
//       null, // limit
//       true); // count

//     Utils.recordAction('Head', 'CommentPeriod', args.swagger.params.auth_payload.preferred_username, args.swagger.params.commentPeriodId && args.swagger.params.commentPeriodId.value ? args.swagger.params.commentPeriodId.value : null);

//     // /api/commentperiod/ route, return 200 OK with 0 items if necessary
//     if (!(args.swagger.params.commentPeriodId && args.swagger.params.commentPeriodId.value) || (data && data.length > 0)) {
//       res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items : 0);
//       return Actions.sendResponse(res, 200, data);
//     } else {
//       return Actions.sendResponse(res, 404, data);
//     }
//   } catch (e) {
//     defaultLog.info('Error:', e);
//     return Actions.sendResponse(res, 400, e);
//   }
// }

// exports.protectedSummary = async function (args, res, next) {
//   defaultLog.info('Head for comment period summaries');

//   // Build match query if on CommentPeriodId route
//   var query = {};
//   if (args.swagger.params.commentPeriodId && args.swagger.params.commentPeriodId.value) {
//     _.assignIn(query, { period: mongoose.Types.ObjectId(args.swagger.params.commentPeriodId.value) });
//   }
//   // Unless they specifically ask for it, hide deleted results.
//   if (args.swagger.params.isDeleted && args.swagger.params.isDeleted.value != undefined) {
//     _.assignIn(query, { isDeleted: args.swagger.params.isDeleted.value });
//   }

//   // Set query type
//   _.assignIn(query, { '_schemaName': 'Comment' });

//   Utils.recordAction('summary', 'commentPeriod', args.swagger.params.auth_payload.preferred_username);

//   var options = ['Pending', 'Deferred', 'Published', 'Rejected'];
//   try {
//     var summary = {
//       'Pending': 0,
//       'Deferred': 0,
//       'Published': 0,
//       'Rejected': 0
//     }
//     await Promise.all(options.map(async (item) => {
//       var optionQuery = {};
//       _.assignIn(optionQuery, { 'eaoStatus': item, period: mongoose.Types.ObjectId(args.swagger.params.commentPeriodId.value) });
//       console.log("optionQuery:", optionQuery);
//       var res = await Utils.runDataQuery('CommentPeriod',
//         args.swagger.params.auth_payload.realm_access.roles,
//         optionQuery,
//         ['_id', 'read', 'write', 'delete'], // Fields
//         null, // sort warmup
//         null, // sort
//         null, // skip
//         null, // limit
//         true); // count
//       Utils.recordAction('Summary', 'CommentPeriod', args.swagger.params.auth_payload.preferred_username, args.swagger.params.commentPeriodId && args.swagger.params.commentPeriodId.value ? args.swagger.params.commentPeriodId.value : null);
//       console.log("RES:", res);
//       if (res && res[0]) {
//         summary[item] = res[0]['total_items'];
//       }
//       return summary;
//     }));

//     console.log("sending summary:", summary);
//     return Actions.sendResponse(res, 200, summary);
//   } catch (e) {
//     defaultLog.info('Error:', e);
//     return Actions.sendResponse(res, 400, e);
//   }
// }


exports.protectedGet = async function (args, res, next) {
  defaultLog.info('Getting survey(s)');

  var query = {}, sort = null, skip = null, limit = null, count = false;

  // Build match query if on survey route
  if (args.swagger.params.surveyId && args.swagger.params.surveyId.value) {
    defaultLog.info('Survey id:', args.swagger.params.surveyId.value);
    query = Utils.buildQuery('_id', args.swagger.params.surveyId.value, query);
  }

  // Build match query if on project's id
  if (args.swagger.params.project && args.swagger.params.project.value) {
    _.assignIn(query, { project: mongoose.Types.ObjectId(args.swagger.params.project.value) });
  }

  // 
  if (args.swagger.params.commentPeriod && args.swagger.params.commentPeriod.value) {
    const CommentPeriod = mongoose.model('CommentPeriod');
    await CommentPeriod.findById(args.swagger.params.commentPeriod.value)
    .exec()
    .then(cp => {
        query = Utils.buildQuery('_id', cp.surveySelected, query);
    })
  }

  // sort
  if (args.swagger.params.sortBy && args.swagger.params.sortBy.value) {
    sort = {};
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

  console.log('the fields', args.swagger.params.fields.value)

  // Set query type
  _.assignIn(query, { '_schemaName': 'Survey' });

  try {
    var data = await Utils.runDataQuery('Survey',
      args.swagger.params.auth_payload.realm_access.roles,
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null,   // sort warmup
      sort,   // sort
      skip,   // skip
      limit,  // limit
      count); // count

    Utils.recordAction('Get', 'Survey', args.swagger.params.auth_payload.preferred_username, args.swagger.params.surveyId && args.swagger.params.surveyId.value ? args.swagger.params.surveyId.value : null);
    defaultLog.info('Got survey(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

//  Create a new Survey
exports.protectedPost = async function (args, res, next) {
  var obj = args.swagger.params.survey.value;

  defaultLog.info('Create new survey:', obj);

  var Survey = mongoose.model('Survey');

  var survey = new Survey({
    _schemaName: 'Survey',
    // addedBy: args.swagger.params.auth_payload.preferred_username,
    lastSaved: obj.lastSaved,
    name: obj.name,
    commentPeriod: obj.commentPeriod,
    project: obj.project,
    questions: obj.questions,

    read: ['staff', 'sysadmin'],
    write: ['staff', 'sysadmin'],
    delete: ['staff', 'sysadmin']
  });

  try {
    var sq = await survey.save();
    Utils.recordAction('Post', 'Survey', args.swagger.params.auth_payload.preferred_username, sq._id);
    defaultLog.info('Saved new survey object:', sq);
    return Actions.sendResponse(res, 200, sq);
  } catch (e) {
    defaultLog.info('The error was:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

// Update an existing Survey
exports.protectedPut = async function (args, res, next) {
  var objId = args.swagger.params.surveyId.value;
  var obj = args.swagger.params.s.value;
  defaultLog.info('Put survey:', objId);

  var Survey = mongoose.model('Survey');

  var survey = {
    name: obj.name,
    lastSaved: new Date(),
    project: obj.project,
    commentPeriod: obj.commentPeriod,
    questions: obj.questions
  };

  // TODO: Revise this so we are not explicitly setting permissions
  // if (obj.isPublished) {
  //   commentPeriod['read'] = ['public', 'staff', 'sysadmin'];
  // } else {
  //   commentPeriod['read'] = ['staff', 'sysadmin'];
  // }

  defaultLog.info('Incoming updated object:', survey);

  try {
    var s = await Survey.update({ _id: objId }, { $set: survey });
    Utils.recordAction('Put', 'Survey', args.swagger.params.auth_payload.preferred_username, objId);
    defaultLog.info('Survey updated:', s);
    return Actions.sendResponse(res, 200, s);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
}

// //  Delete a new CommentPeriod
exports.protectedDelete = async function (args, res, next) {
  var objId = args.swagger.params.surveyId.value;
  defaultLog.info('Delete survey:', objId);

  var Survey = mongoose.model('Survey');
  try {
    await Survey.findOneAndRemove({ _id: objId });
    Utils.recordAction('Delete', 'Survey', args.swagger.params.auth_payload.preferred_username, objId);
    return Actions.sendResponse(res, 200, {});
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

