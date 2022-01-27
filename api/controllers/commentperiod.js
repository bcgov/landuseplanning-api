var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');

var getSanitizedFields = function (fields) {
  return _.remove(fields, function (f) {
    return (_.indexOf([
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
      'commentingMethod',
      'externalToolPopupText',
      'surveySelected',
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
      'commentPeriodInfo',

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

  if (args.swagger.params.commentPeriodId && args.swagger.params.commentPeriodId.value) {
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
      false,
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null, // sort warmup
      sort, // sort
      null, // skip
      null, // limit
      false); // count

    Utils.recordAction('Get', 'CommentPeriod', 'public', args.swagger.params.commentPeriodId && args.swagger.params.commentPeriodId.value ? args.swagger.params.commentPeriodId.value : null);
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
      args.swagger.params.auth_payload.sub,
      query,
      ['_id', 'read', 'write', 'delete'], // Fields
      null, // sort warmup
      null, // sort
      null, // skip
      null, // limit
      true); // count

    Utils.recordAction('Head', 'CommentPeriod', args.swagger.params.auth_payload.preferred_username, args.swagger.params.commentPeriodId && args.swagger.params.commentPeriodId.value ? args.swagger.params.commentPeriodId.value : null);

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

exports.protectedSummary = async function (args, res, next) {
  defaultLog.info('Summary for comment period summaries');

  // Build match query if on CommentPeriodId route
  var query = {};
  if (args.swagger.params.commentPeriodId && args.swagger.params.commentPeriodId.value) {
    _.assignIn(query, { period: mongoose.Types.ObjectId(args.swagger.params.commentPeriodId.value) });
  }
  // Unless they specifically ask for it, hide deleted results.
  if (args.swagger.params.isDeleted && args.swagger.params.isDeleted.value != undefined) {
    _.assignIn(query, { isDeleted: args.swagger.params.isDeleted.value });
  }

  // Set query type
  _.assignIn(query, { '_schemaName': 'Comment' });

  Utils.recordAction('summary', 'commentPeriod', args.swagger.params.auth_payload.preferred_username);

  var options = ['Pending', 'Deferred', 'Published', 'Rejected'];
  try {
    var summary = {
      'Pending': 0,
      'Deferred': 0,
      'Published': 0,
      'Rejected': 0
    }
    await Promise.all(options.map(async (item) => {
      var optionQuery = {};
      _.assignIn(optionQuery, { 'eaoStatus': item, period: mongoose.Types.ObjectId(args.swagger.params.commentPeriodId.value) });
      console.log("optionQuery:", optionQuery);
      var res = await Utils.runDataQuery('CommentPeriod',
        args.swagger.params.auth_payload.realm_access.roles,
        args.swagger.params.auth_payload.sub,
        optionQuery,
        ['_id', 'read', 'write', 'delete'], // Fields
        null, // sort warmup
        null, // sort
        null, // skip
        null, // limit
        true); // count
      Utils.recordAction('Summary', 'CommentPeriod', args.swagger.params.auth_payload.preferred_username, args.swagger.params.commentPeriodId && args.swagger.params.commentPeriodId.value ? args.swagger.params.commentPeriodId.value : null);
      console.log("RES:", res);
      if (res && res[0]) {
        summary[item] = res[0]['total_items'];
      }
      return summary;
    }));

    console.log("sending summary:", summary);
    return Actions.sendResponse(res, 200, summary);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
}


exports.protectedGet = async function (args, res, next) {
  defaultLog.info('Getting comment period(s)');

  var query = {}, sort = null, skip = null, limit = null, count = false;

  // Build match query if on CommentPeriodId route
  if (args.swagger.params.commentPeriodId && args.swagger.params.commentPeriodId.value) {
    defaultLog.info('Comment period id:', args.swagger.params.commentPeriodId.value);
    query = Utils.buildQuery('_id', args.swagger.params.commentPeriodId.value, query);
  }

  // Build match query if on project's id
  if (args.swagger.params.project && args.swagger.params.project.value) {
    _.assignIn(query, { project: mongoose.Types.ObjectId(args.swagger.params.project.value) });
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

  // Set query type
  _.assignIn(query, { '_schemaName': 'CommentPeriod' });

  try {
    var data = await Utils.runDataQuery('CommentPeriod',
      args.swagger.params.auth_payload.realm_access.roles,
      args.swagger.params.auth_payload.sub,
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null,   // sort warmup
      sort,   // sort
      skip,   // skip
      limit,  // limit
      count); // count
    Utils.recordAction('Get', 'CommentPeriod', args.swagger.params.auth_payload.preferred_username, args.swagger.params.commentPeriodId && args.swagger.params.commentPeriodId.value ? args.swagger.params.commentPeriodId.value : null);
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
    addedBy: args.swagger.params.auth_payload.preferred_username,
    commentIdCount: 0,
    dateAdded: new Date(),
    dateCompleted: obj.dateCompleted,
    dateStarted: obj.dateStarted,
    instructions: obj.instructions,
    commentingMethod: obj.commentingMethod,
    externalToolPopupText: obj.externalToolPopupText,
    surveySelected: obj.surveySelected ? mongoose.Types.ObjectId(obj.surveySelected) : obj.surveySelected,
    openHouses: obj.openHouses,
    relatedDocuments: obj.relatedDocuments,
    project: mongoose.Types.ObjectId(obj.project),
    commentPeriodInfo: obj.commentPeriodInfo,
    read: ['staff', 'sysadmin'],
    write: ['staff', 'sysadmin'],
    delete: ['staff', 'sysadmin']
  });

  if (obj.isPublished) {
    commentPeriod.read.push('public');
  }

  try {
    var cp = await commentPeriod.save();
    Utils.recordAction('Put', 'CommentPeriod', args.swagger.params.auth_payload.preferred_username, cp._id);
    defaultLog.info('Saved new comment period object:', cp);

    // Only update survey visibility if survey selected by CP
    if (commentPeriod.surveySelected) {
      await updateVisibleSurveys(CommentPeriod);
    }

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

  var CommentPeriod = mongoose.model('CommentPeriod');

  await updateVisibleSurveys(CommentPeriod) 


  var commentPeriod = {
    dateCompleted: obj.dateCompleted,
    dateStarted: obj.dateStarted,
    dateUpdated: new Date(),
    instructions: obj.instructions,
    commentingMethod: obj.commentingMethod,
    externalToolPopupText: obj.externalToolPopupText,
    surveySelected: obj.surveySelected,
    openHouses: obj.openHouses,
    relatedDocuments: obj.relatedDocuments,
    updatedBy: args.swagger.params.auth_payload.preferred_username,
    commentPeriodInfo: obj.commentPeriodInfo
  };

  // TODO: Revise this so we are not explicitly setting permissions
  if (obj.isPublished) {
    commentPeriod['read'] = ['public', 'staff', 'sysadmin'];
  } else {
    commentPeriod['read'] = ['staff', 'sysadmin'];
  }

  defaultLog.info('Incoming updated object:', commentPeriod);

  try {
    var cp = await CommentPeriod.update({ _id: objId }, { $set: commentPeriod });
    Utils.recordAction('Put', 'CommentPeriod', args.swagger.params.auth_payload.preferred_username, objId);
    defaultLog.info('Comment period updated:', cp);

    await updateVisibleSurveys(CommentPeriod);

    return Actions.sendResponse(res, 200, cp);
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
    Utils.recordAction('Delete', 'CommentPeriod', args.swagger.params.auth_payload.preferred_username, objId);

    await updateVisibleSurveys(CommentPeriod);
    
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
    var publishedCP = await Actions.publish(commentPeriod);
    Utils.recordAction('Publish', 'CommentPeriod', args.swagger.params.auth_payload.preferred_username, objId);

    await updateVisibleSurveys(CommentPeriod);

    return Actions.sendResponse(res, 200, publishedCP);
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
    Utils.recordAction('Unpublish', 'CommentPeriod', args.swagger.params.auth_payload.preferred_username, objId);

    await updateVisibleSurveys(CommentPeriod);
    
    return Actions.sendResponse(res, 200, unpublished);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

const publishSelectedSurveys = async function (surveyId) {
  const Survey = mongoose.model('Survey');
  const survey = await Survey.findOne({ _id: surveyId });
  const publishedSurvey = await Actions.publish(survey);
}

const unpublishSelectedSurveys = async function (survey) {
  const unpublishedSurvey = await Actions.unPublish(survey);
}

const updateVisibleSurveys = async function (CommentPeriod) {
    const surveysToPublish = await CommentPeriod.find({_schemaName: 'CommentPeriod', read: 'public'})
        .where("surveySelected")
        .ne(null)
        .select('surveySelected');

    const publishIDs = surveysToPublish.map(surveyObj => surveyObj.surveySelected)

    const Survey = mongoose.model('Survey')
    const surveysToUnpublish = await Survey.find({_schemaName: 'Survey'})
        .where("_id")
        .nin(publishIDs)

    publishIDs.forEach(surveyId => publishSelectedSurveys(surveyId))
    surveysToUnpublish.forEach(survey => unpublishSelectedSurveys(survey))
}
