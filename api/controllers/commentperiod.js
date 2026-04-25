const _ = require('lodash');
const defaultLog = require('winston').loggers.get('defaultLog');
const mongoose = require('mongoose');
const Actions = require('../helpers/actions');
const Utils = require('../helpers/utils');

/**
 * Avoid mutating input; filter only the allowed fields.
 * Using a Set is faster and clearer than _.indexOf().
 */
const CP_ALLOWED_FIELDS = new Set([
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
  'externalToolPopupURL',
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
  'delete',
]);

const getSanitizedFields = (fields = []) =>
  fields.filter((f) => CP_ALLOWED_FIELDS.has(f));

exports.protectedOptions = (args, res) => {
  defaultLog.info('COMMENT PERIOD PROTECTED OPTIONS');
  res.status(200).send();
};

exports.publicGet = async (args, res) => {
  defaultLog.info('COMMENT PERIOD PUBLIC GET');

  // Build match query if on CommentPeriodId route
  let query = {},
    sort = {};

  if (
    args.swagger.params.commentPeriodId &&
    args.swagger.params.commentPeriodId.value
  ) {
    query = Utils.buildQuery(
      '_id',
      args.swagger.params.commentPeriodId.value,
      query,
    );
  }
  if (args.swagger.params.project && args.swagger.params.project.value) {
    query = Utils.buildQuery(
      'project',
      args.swagger.params.project.value,
      query,
    );
  }

  // sort
  if (args.swagger.params.sortBy && args.swagger.params.sortBy.value) {
    args.swagger.params.sortBy.value.forEach((value) => {
      const order_by = value.charAt(0) === '-' ? -1 : 1;
      const sort_by = value.slice(1);
      // only accept certain fields
      switch (sort_by) {
        case 'dateStarted':
        case 'dateCompleted':
        case 'author':
          sort[sort_by] = order_by;
          break;
        default:
          break;
      }
    });
  }

  // Set query type
  _.assignIn(query, { _schemaName: 'CommentPeriod' });

  try {
    const data = await Utils.runDataQuery(
      'CommentPeriod',
      ['public'],
      false,
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null, // sort warmup
      sort, // sort
      null, // skip
      null, // limit
      false, // count
    );

    Utils.recordAction(
      'Get',
      'CommentPeriod',
      'public',
      args.swagger.params.commentPeriodId &&
        args.swagger.params.commentPeriodId.value
        ? args.swagger.params.commentPeriodId.value
        : null,
    );
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    return Actions.sendResponse(
      res,
      400,
      e,
      'Comment period public get failed',
    );
  }
};

exports.protectedHead = async (args, res) => {
  defaultLog.info('COMMENT PERIOD PROTECTED HEAD');

  // Build match query if on CommentPeriodId route
  let query = {};
  if (
    args.swagger.params.commentPeriodId &&
    args.swagger.params.commentPeriodId.value
  ) {
    query = Utils.buildQuery(
      '_id',
      args.swagger.params.commentPeriodId.value,
      query,
    );
  }
  if (args.swagger.params.project && args.swagger.params.project.value) {
    query = Utils.buildQuery(
      'project',
      args.swagger.params.project.value,
      query,
    );
  }
  // Unless they specifically ask for it, hide deleted results.
  if (
    args.swagger.params.isDeleted &&
    args.swagger.params.isDeleted.value !== undefined
  ) {
    _.assignIn(query, { isDeleted: args.swagger.params.isDeleted.value });
  }

  // Set query type
  _.assignIn(query, { _schemaName: 'CommentPeriod' });

  try {
    const data = await Utils.runDataQuery(
      'CommentPeriod',
      args.swagger.params.auth_payload.client_roles,
      args.swagger.params.auth_payload.idir_user_guid,
      query,
      ['_id', 'read', 'write', 'delete'], // Fields
      null, // sort warmup
      null, // sort
      null, // skip
      null, // limit
      true, // count
    );

    Utils.recordAction(
      'Head',
      'CommentPeriod',
      args.swagger.params.auth_payload.preferred_username,
      args.swagger.params.commentPeriodId &&
        args.swagger.params.commentPeriodId.value
        ? args.swagger.params.commentPeriodId.value
        : null,
    );

    // /api/commentperiod/ route, return 200 OK with 0 items if necessary
    if (
      !(
        args.swagger.params.commentPeriodId &&
        args.swagger.params.commentPeriodId.value
      ) ||
      (data && data.length > 0)
    ) {
      res.setHeader(
        'x-total-count',
        data && data.length > 0 ? data[0].total_items : 0,
      );
      return Actions.sendResponse(res, 200, data);
    } else {
      return Actions.sendResponse(res, 404, data);
    }
  } catch (e) {
    return Actions.sendResponse(
      res,
      400,
      e,
      'Comment period protected head failed',
    );
  }
};

exports.protectedSummary = async (args, res) => {
  defaultLog.info('COMMENT PERIOD SUMMARY');

  // Build match query if on CommentPeriodId route
  let query = {};
  if (
    args.swagger.params.commentPeriodId &&
    args.swagger.params.commentPeriodId.value
  ) {
    _.assignIn(query, {
      period: mongoose.Types.ObjectId(
        args.swagger.params.commentPeriodId.value,
      ),
    });
  }
  // Unless they specifically ask for it, hide deleted results.
  if (
    args.swagger.params.isDeleted &&
    args.swagger.params.isDeleted.value !== undefined
  ) {
    _.assignIn(query, { isDeleted: args.swagger.params.isDeleted.value });
  }

  // Set query type
  _.assignIn(query, { _schemaName: 'Comment' });

  Utils.recordAction(
    'summary',
    'commentPeriod',
    args.swagger.params.auth_payload.preferred_username,
  );

  const options = ['Pending', 'Deferred', 'Published', 'Rejected'];
  try {
    const summary = { Pending: 0, Deferred: 0, Published: 0, Rejected: 0 };

    await Promise.all(
      options.map(async (item) => {
        const optionQuery = {
          eaoStatus: item,
          period: mongoose.Types.ObjectId(
            args.swagger.params.commentPeriodId.value,
          ),
          _schemaName: 'Comment',
        };

        const result = await Utils.runDataQuery(
          'CommentPeriod',
          args.swagger.params.auth_payload.client_roles,
          args.swagger.params.auth_payload.idir_user_guid,
          optionQuery,
          ['_id', 'read', 'write', 'delete'], // Fields
          null, // sort warmup
          null, // sort
          null, // skip
          null, // limit
          true, // count
        );

        Utils.recordAction(
          'Summary',
          'CommentPeriod',
          args.swagger.params.auth_payload.preferred_username,
          args.swagger.params.commentPeriodId &&
            args.swagger.params.commentPeriodId.value
            ? args.swagger.params.commentPeriodId.value
            : null,
        );

        if (result && result[0]) {
          summary[item] = result[0].total_items;
        }
        return summary;
      }),
    );

    defaultLog.info('Summary:', summary);
    return Actions.sendResponse(res, 200, summary);
  } catch (e) {
    return Actions.sendResponse(
      res,
      400,
      e,
      'Comment period protected summary failed',
    );
  }
};

exports.protectedGet = async (args, res) => {
  defaultLog.info('COMMENT PERIOD PROTECTED GET');

  let query = {},
    sort = null,
    skip = null,
    limit = null,
    count = false;

  // Build match query if on CommentPeriodId route
  if (
    args.swagger.params.commentPeriodId &&
    args.swagger.params.commentPeriodId.value
  ) {
    defaultLog.info(
      'Comment period id:',
      args.swagger.params.commentPeriodId.value,
    );
    query = Utils.buildQuery(
      '_id',
      args.swagger.params.commentPeriodId.value,
      query,
    );
  }

  // Build match query if on project's id
  if (args.swagger.params.project && args.swagger.params.project.value) {
    _.assignIn(query, {
      project: mongoose.Types.ObjectId(args.swagger.params.project.value),
    });
  }

  // sort
  if (args.swagger.params.sortBy && args.swagger.params.sortBy.value) {
    sort = {};
    args.swagger.params.sortBy.value.forEach((value) => {
      const order_by = value.charAt(0) === '-' ? -1 : 1;
      const sort_by = value.slice(1);
      sort[sort_by] = order_by;
    });
  }

  // Skip and limit
  const processedParameters = Utils.getSkipLimitParameters(
    args.swagger.params.pageSize,
    args.swagger.params.pageNum,
  );
  skip = processedParameters.skip;
  limit = processedParameters.limit;

  // Count
  if (args.swagger.params.count && args.swagger.params.count.value) {
    count = args.swagger.params.count.value;
  }

  // Set query type
  _.assignIn(query, { _schemaName: 'CommentPeriod' });

  try {
    const data = await Utils.runDataQuery(
      'CommentPeriod',
      args.swagger.params.auth_payload.client_roles,
      args.swagger.params.auth_payload.idir_user_guid,
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null, // sort warmup
      sort, // sort
      skip, // skip
      limit, // limit
      count, // count
    );
    Utils.recordAction(
      'Get',
      'CommentPeriod',
      args.swagger.params.auth_payload.preferred_username,
      args.swagger.params.commentPeriodId &&
        args.swagger.params.commentPeriodId.value
        ? args.swagger.params.commentPeriodId.value
        : null,
    );
    defaultLog.info('Got comment period(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    return Actions.sendResponse(
      res,
      400,
      e,
      'Comment period protected get failed',
    );
  }
};

//  Create a new CommentPeriod
exports.protectedPost = async (args, res) => {
  defaultLog.info('COMMENT PERIOD PROTECTED POST');
  const obj = args.swagger.params.period.value;

  defaultLog.info('Incoming new comment period:', obj);

  const CommentPeriod = mongoose.model('CommentPeriod');

  const commentPeriod = new CommentPeriod({
    _schemaName: 'CommentPeriod',
    addedBy: args.swagger.params.auth_payload.preferred_username,
    commentIdCount: 0,
    dateAdded: new Date(),
    dateCompleted: obj.dateCompleted,
    dateStarted: obj.dateStarted,
    instructions: obj.instructions,
    commentingMethod: obj.commentingMethod,
    externalToolPopupText: obj.externalToolPopupText,
    externalToolPopupURL: obj.externalToolPopupURL,
    surveySelected: obj.surveySelected
      ? mongoose.Types.ObjectId(obj.surveySelected)
      : obj.surveySelected,
    openHouses: obj.openHouses,
    relatedDocuments: obj.relatedDocuments,
    project: mongoose.Types.ObjectId(obj.project),
    commentPeriodInfo: obj.commentPeriodInfo,
    read: ['staff', 'sysadmin'],
    write: ['staff', 'sysadmin'],
    delete: ['staff', 'sysadmin'],
  });

  if (obj.isPublished) {
    commentPeriod.read.push('public');
  }

  try {
    const cp = await commentPeriod.save();
    Utils.recordAction(
      'Put',
      'CommentPeriod',
      args.swagger.params.auth_payload.preferred_username,
      cp._id,
    );
    defaultLog.info('Saved new comment period object:', cp._id);

    // Only update survey visibility if survey selected by CP
    if (commentPeriod.surveySelected) {
      await updateVisibleSurveys(commentPeriod);
    }

    return Actions.sendResponse(res, 200, cp);
  } catch (e) {
    return Actions.sendResponse(
      res,
      400,
      e,
      'Comment period protected post failed',
    );
  }
};

// Update an existing CommentPeriod
exports.protectedPut = async (args, res) => {
  defaultLog.info('COMMENT PERIOD PROTECTED PUT');
  const objId = args.swagger.params.commentPeriodId.value;
  const obj = args.swagger.params.cp.value;
  defaultLog.info('Incoming comment period data:', objId);

  const CommentPeriod = mongoose.model('CommentPeriod');

  const commentPeriod = {
    dateCompleted: obj.dateCompleted,
    dateStarted: obj.dateStarted,
    dateUpdated: new Date(),
    instructions: obj.instructions,
    commentingMethod: obj.commentingMethod,
    externalToolPopupText: obj.externalToolPopupText,
    externalToolPopupURL: obj.externalToolPopupURL,
    surveySelected: obj.surveySelected,
    openHouses: obj.openHouses,
    relatedDocuments: obj.relatedDocuments,
    updatedBy: args.swagger.params.auth_payload.preferred_username,
    commentPeriodInfo: obj.commentPeriodInfo,
  };

  await updateVisibleSurveys(commentPeriod);

  // TODO: Revise this so we are not explicitly setting permissions
  commentPeriod.read = obj.isPublished
    ? ['public', 'staff', 'sysadmin']
    : ['staff', 'sysadmin'];

  try {
    // Use findByIdAndUpdate so we get a document back and avoid deprecated update()
    const cp = await CommentPeriod.findByIdAndUpdate(
      objId,
      { $set: commentPeriod },
      { new: true },
    );

    Utils.recordAction(
      'Put',
      'CommentPeriod',
      args.swagger.params.auth_payload.preferred_username,
      objId,
    );
    defaultLog.info('Comment period updated:', cp && cp._id);

    await updateVisibleSurveys(commentPeriod);

    return Actions.sendResponse(res, 200, cp);
  } catch (e) {
    return Actions.sendResponse(
      res,
      400,
      e,
      'Comment period protected put failed',
    );
  }
};

//  Delete a CommentPeriod
exports.protectedDelete = async (args, res) => {
  defaultLog.info('COMMENT PERIOD PROTECTED DELETE');
  const objId = args.swagger.params.commentPeriodId.value;
  defaultLog.info('Delete comment period:', objId);

  const CommentPeriod = mongoose.model('CommentPeriod');
  try {
    const deleted = await CommentPeriod.findByIdAndDelete(objId);
    defaultLog.info('Comment period deleted:', objId);
    Utils.recordAction(
      'Delete',
      'CommentPeriod',
      args.swagger.params.auth_payload.preferred_username,
      objId,
    );
    await updateVisibleSurveys(deleted);
    return Actions.sendResponse(res, 200, deleted || {});
  } catch (e) {
    return Actions.sendResponse(
      res,
      400,
      e,
      'Comment period protected delete failed',
    );
  }
};

// Publish the CommentPeriod
exports.protectedPublish = async (args, res) => {
  defaultLog.info('COMMENT PERIOD PROTECTED PUBLISH');
  const objId = args.swagger.params.commentPeriodId.value;
  defaultLog.info('Publish comment period:', objId);

  const CommentPeriod = mongoose.model('CommentPeriod');

  try {
    const commentPeriod = await CommentPeriod.findOne({ _id: objId });
    if (!commentPeriod) {
      return Actions.sendResponse(res, 404, {
        message: 'CommentPeriod not found',
      });
    }
    delete commentPeriod.__v;

    // Add public to read array.
    const publishedCP = await Actions.publish(commentPeriod);
    defaultLog.info('Published comment period:', objId);
    Utils.recordAction(
      'Publish',
      'CommentPeriod',
      args.swagger.params.auth_payload.preferred_username,
      objId,
    );

    await updateVisibleSurveys(commentPeriod);

    return Actions.sendResponse(res, 200, publishedCP);
  } catch (e) {
    return Actions.sendResponse(
      res,
      400,
      e,
      'Comment period protected publish failed',
    );
  }
};

// Unpublish the CommentPeriod
exports.protectedUnPublish = async (args, res) => {
  defaultLog.info('COMMENT PERIOD PROTECTED UNPUBLISH');
  const objId = args.swagger.params.commentPeriodId.value;
  defaultLog.info('UnPublish comment period:', objId);

  const CommentPeriod = mongoose.model('CommentPeriod');
  try {
    const commentPeriod = await CommentPeriod.findOne({ _id: objId });
    if (!commentPeriod) {
      return Actions.sendResponse(res, 404, {
        message: 'CommentPeriod not found',
      });
    }
    delete commentPeriod.__v;

    // Remove public from read array.
    const unpublished = await Actions.unPublish(commentPeriod);
    defaultLog.info('Unpublished comment period:', objId);
    Utils.recordAction(
      'Unpublish',
      'CommentPeriod',
      args.swagger.params.auth_payload.preferred_username,
      objId,
    );

    await updateVisibleSurveys(commentPeriod);

    return Actions.sendResponse(res, 200, unpublished);
  } catch (e) {
    return Actions.sendResponse(
      res,
      400,
      e,
      'Comment period protected unpublish failed',
    );
  }
};

const publishSurveyById = async (surveyId) => {
  if (!surveyId) {
    defaultLog.error('Survey ID is missing.');
    return;
  }

  const Survey = mongoose.model('Survey');
  const survey = await Survey.findOne({ _id: surveyId });

  if (!survey || !survey.read || !Array.isArray(survey.read)) {
    defaultLog.error(
      'Survey publish read permissions are malformed.',
      surveyId,
    );
    return;
  } else if (survey.read.includes('public')) {
    defaultLog.info('Survey was already published, skipping.', surveyId);
    return;
  }
  return Actions.publish(survey);
};

const unpublishSurveyById = async (surveyId) => {
  if (!surveyId) {
    defaultLog.error('Survey ID is missing.');
    return;
  }
  const Survey = mongoose.model('Survey');
  const survey = await Survey.findOne({ _id: surveyId });

  if (!survey || !survey.read || !Array.isArray(survey.read)) {
    defaultLog.error(
      'Survey unpublish read permissions are malformed:',
      surveyId,
    );
    return;
  } else if (!survey.read.includes('public')) {
    defaultLog.info('Survey was already unpublished, skipping.', surveyId);
    return;
  }
  return Actions.unPublish(survey);
};

const updateVisibleSurveys = async (commentPeriod) => {
  defaultLog.info('UPDATE VISIBLE SURVEYS');
  const surveysAreArray = Array.isArray(commentPeriod.surveySelected);
  const surveyActions = { publish: [], unpublish: [] };
  const isPublic = Array.isArray(commentPeriod.read)
    ? commentPeriod.read.includes('public')
    : false;

  if (isPublic) {
    surveyActions.publish = surveysAreArray
      ? [...commentPeriod.surveySelected]
      : commentPeriod.surveySelected
        ? [commentPeriod.surveySelected]
        : [];
  } else {
    surveyActions.unpublish = surveysAreArray
      ? [...commentPeriod.surveySelected]
      : commentPeriod.surveySelected
        ? [commentPeriod.surveySelected]
        : [];
  }

  try {
    const publishTasks =
      Array.isArray(surveyActions.publish) &&
      surveyActions.publish.length > 0 &&
      surveyActions.publish.map((id) => publishSurveyById(id));
    const unpublishTasks =
      Array.isArray(surveyActions.unpublish) &&
      surveyActions.unpublish.length > 0 &&
      surveyActions.unpublish.map((id) => unpublishSurveyById(id));
    const allTasks = [...(publishTasks || []), ...(unpublishTasks || [])];

    await Promise.all(allTasks);
    defaultLog.info('Visible surveys have been updated.', {
      published: surveyActions.publish.join(', '),
      unpublished: surveyActions.unpublish.join(', '),
    });
  } catch (e) {
    defaultLog.error('Failed to update visible surveys', {
      status: e && (e.status || e.statusCode),
      err: { name: e && e.name, message: e && e.message, stack: e && e.stack }
    });
  }
};
