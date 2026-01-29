const { remove, indexOf, assignIn } = require('lodash');
const defaultLog = require('winston').loggers.get('defaultLog');
const mongoose = require('mongoose');
const Actions = require('../helpers/actions');
const Utils = require('../helpers/utils');

const getSanitizedFields = (fields) => {
  return remove(fields, (f) => {
    return (
      indexOf(
        [
          '_schemaName',
          'name',
          'lastSaved',
          'dateAdded',
          'project',
          'questions',
          'read',
          'write',
          'delete',
        ],
        f
      ) !== -1
    );
  });
};

exports.protectedOptions = (args, res) => {
  defaultLog.info('SURVEY PROTECTED OPTIONS');
  res.status(200).send();
};

exports.publicGet = async (args, res) => {
  defaultLog.info('SURVEY PUBLIC GET');

  const CommentPeriod = mongoose.model('CommentPeriod');

  // Build match query if on SurveyId route
  let query = {},
    sort = {};
  const params = args.swagger.params;

  if (params.surveyId && params.surveyId.value) {
    query = Utils.buildQuery('_id', params.surveyId.value, query);
  }
  if (params.project && params.project.value) {
    query = Utils.buildQuery(
      'project',
      params.project.value,
      query
    );
  }
  if (params && params.commentPeriod && params.commentPeriod.value) {
    try {
      const cp = await CommentPeriod.findById(
        params.commentPeriod.value
      ).exec();
      if (cp && cp.surveySelected) {
        query = Utils.buildQuery('_id', cp.surveySelected, query);
      }
    } catch (err) {
      defaultLog.error(err);
    }
  }

  // Set query type
  assignIn(query, { _schemaName: 'Survey' });

  try {
    const data = await Utils.runDataQuery(
      'Survey',
      ['public'],
      false,
      query,
      getSanitizedFields(params.fields.value), // Fields
      null, // sort warmup
      sort, // sort
      null, // skip
      null, // limit
      false
    ); // count

    Utils.recordAction(
      'Get',
      'Survey',
      'public',
      params.surveyId && params.surveyId.value
        ? params.surveyId.value
        : null
    );
    defaultLog.info('Got survey(s): ', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedGet = async (args, res) => {
  defaultLog.info('SURVEY PROTECTED GET');
  let query = {},
    sort = null,
    skip = null,
    limit = null,
    count = false;
  const params = args.swagger.params;

  // Build match query if on survey route
  if (params.surveyId && params.surveyId.value) {
    defaultLog.info('Get survey by id:', params.surveyId.value);
    query = Utils.buildQuery('_id', params.surveyId.value, query);
  }

  // Build match query if on project's id
  if (params.project && params.project.value) {
    assignIn(query, {
      project: mongoose.Types.ObjectId(params.project.value),
    });
  }

  //
  if (params.commentPeriod && params.commentPeriod.value) {
    const CommentPeriod = mongoose.model('CommentPeriod');
    try {
      const cp = await CommentPeriod.findById(
        params.commentPeriod.value
      ).exec();
      if (cp && cp.surveySelected) {
        query = Utils.buildQuery('_id', cp.surveySelected, query);
      }
    } catch (err) {
      defaultLog.error(err);
    }
  }

  // sort
  if (params.sortBy && params.sortBy.value) {
    sort = {};
    params.sortBy.value.forEach((value) => {
      const order_by = value.charAt(0) == '-' ? -1 : 1;
      const sort_by = value.slice(1);
      sort[sort_by] = order_by;
    });
  }

  // Skip and limit
  const processedParameters = Utils.getSkipLimitParameters(
    params.pageSize,
    params.pageNum
  );
  skip = processedParameters.skip;
  limit = processedParameters.limit;

  // Count
  if (params && params.count && params.count.value) {
    count = params.count.value;
  }

  // Set query type
  assignIn(query, { _schemaName: 'Survey' });

  try {
    const data = await Utils.runDataQuery(
      'Survey',
      params.auth_payload.client_roles,
      params.auth_payload.idir_user_guid,
      query,
      getSanitizedFields(params.fields.value), // Fields
      null, // sort warmup
      sort, // sort
      skip, // skip
      limit, // limit
      count
    ); // count

    Utils.recordAction(
      'Get',
      'Survey',
      params.auth_payload.preferred_username,
      params.surveyId && params.surveyId.value
        ? params.surveyId.value
        : null
    );
    defaultLog.info('Got survey(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

//  Create a new Survey
exports.protectedPost = async (args, res) => {
  defaultLog.info('SURVEY PROTECTED POST');
  const obj = args.swagger.params.survey.value;

  defaultLog.info('Incoming new survey:', obj);

  const Survey = mongoose.model('Survey');

  const survey = new Survey({
    _schemaName: 'Survey',
    // addedBy: args.swagger.params.auth_payload.preferred_username,
    lastSaved: obj.lastSaved,
    name: obj.name,
    project: obj.project,
    questions: obj.questions,

    read: ['staff', 'sysadmin'],
    write: ['staff', 'sysadmin'],
    delete: ['staff', 'sysadmin'],
  });

  try {
    const sq = await survey.save();
    Utils.recordAction(
      'Post',
      'Survey',
      args.swagger.params.auth_payload.preferred_username,
      sq._id
    );
    defaultLog.info('Saved new survey object:', sq._id);
    return Actions.sendResponse(res, 200, sq);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

// Update an existing Survey
exports.protectedPut = async (args, res) => {
  defaultLog.info('SURVEY PROTECTED PUT');
  const objId = args.swagger.params.surveyId.value;
  const obj = args.swagger.params.s.value;
  defaultLog.info('Put survey:', objId);

  const Survey = mongoose.model('Survey');

  const survey = {
    name: obj.name,
    lastSaved: new Date(),
    project: obj.project,
    questions: obj.questions,
  };

  try {
    const s = await Survey.updateOne({ _id: objId }, { $set: survey });
    Utils.recordAction(
      'Put',
      'Survey',
      args.swagger.params.auth_payload.preferred_username,
      objId
    );
    defaultLog.info('Survey updated:', objId);
    return Actions.sendResponse(res, 200, s);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

//  Delete a survey
exports.protectedDelete = async (args, res) => {
  defaultLog.info('SURVEY PROTECTED DELETE');
  const objId = args.swagger.params.surveyId.value;
  defaultLog.info('Delete survey:', objId);

  const Survey = mongoose.model('Survey');
  try {
    // Check if survey selected by CP and deselect it
    await deselectSurvey(objId);

    // Delete survey
    await Survey.findByIdAndDelete(objId);
    Utils.recordAction(
      'Delete',
      'Survey',
      args.swagger.params.auth_payload.preferred_username,
      objId
    );
    defaultLog.info('Survey deleted: ', objId);
    return Actions.sendResponse(res, 200, {});
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

const deselectSurvey = async (surveyId) => {
  const CommentPeriod = mongoose.model('CommentPeriod');

  await CommentPeriod.updateMany(
    { surveySelected: mongoose.Types.ObjectId(surveyId) },
    { $set: { surveySelected: null } }
  );
};
