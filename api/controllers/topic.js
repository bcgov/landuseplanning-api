const { remove, indexOf, assignIn } = require('lodash');
const defaultLog = require('winston').loggers.get('defaultLog');
const mongoose = require('mongoose');
const Actions = require('../helpers/actions');
const Utils = require('../helpers/utils');

const tagList = ['description', 'name', 'type', 'pillar', 'parent'];

const getSanitizedFields = (fields) => {
  return remove(fields, (f) => {
    return indexOf(tagList, f) !== -1;
  });
};

exports.protectedOptions = (_, res) => {
  res.status(200).send();
};

//  Create a new topic
exports.protectedPost = async (args, res) => {
  const obj = args.swagger.params.topic.value;

  defaultLog.info('Incoming new object:', obj);

  const Topic = mongoose.model('Topic');
  const topic = new Topic({
    ...obj,
    _schemaName: 'Topic',
    read: ['sysadmin'],
    // Change this to use guid instead of idir/user
    _addedBy: args.swagger.params.auth_payload.preferred_username,
  });

  try {
    const theTopic = await topic.save();
    Utils.recordAction(
      'Post',
      'Topic',
      args.swagger.params.auth_payload.preferred_username,
      theTopic._id
    );
    return Actions.sendResponse(res, 200, theTopic);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedGet = async (args, res) => {
  let skip = null,
    limit = null,
    sort = {},
    query = {};
  const params = args.swagger.params;

  if (params.topicId && params.topicId.value) {
    query = Utils.buildQuery('_id', params.topicId.value, query);
  }

  if (params.sortBy && params.sortBy.value) {
    params.sortBy.value.forEach((value) => {
      const order_by = value.charAt(0) == '-' ? -1 : 1;
      const sort_by = value.slice(1);
      sort[sort_by] = order_by;
    });
  }

  const processedParameters = Utils.getSkipLimitParameters(
    params.pageSize,
    params.pageNum
  );
  skip = processedParameters.skip;
  limit = processedParameters.limit;

  // Set query type
  assignIn(query, { _schemaName: 'Topic' });

  try {
    const data = await Utils.runDataQuery(
      'Topic',
      params.auth_payload.client_roles,
      params.auth_payload.idir_user_guid,
      query,
      getSanitizedFields(params.fields.value), // Fields
      null, // sort warmup
      sort, // sort
      skip, // skip
      limit, // limit
      true // count
    );
    Utils.recordAction(
      'Get',
      'Topic',
      params.auth_payload.preferred_username,
      params.topicId && params.topicId.value
        ? params.topicId.value
        : null
    );
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedPut = async (args, res) => {
  const objId = args.swagger.params.topicId.value;
  defaultLog.info('ObjectID:', objId);
  const obj = args.swagger.params.topic.value;

  // Strip security tags - these will not be updated on this route.
  delete obj.tags;

  defaultLog.info('Incoming updated object:', obj);

  const Topic = mongoose.model('Topic');

  // Change this to use guid instead of idir/user
  const updatedBy = args.swagger.params.auth_payload.preferred_username;

  try {
    const data = await Topic.findOneAndUpdate(
      { _id: objId },
      { ...obj, _updatedBy: updatedBy },
      { upsert: false, new: true }
    ).exec();

    Utils.recordAction('Put', 'Topic', updatedBy, objId);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedDelete = async (args, res) => {
  const objId = args.swagger.params.topicId.value;
  defaultLog.info('Delete Topic:', objId);

  const Topic = mongoose.model('Topic');

  try {
    const data = await Topic.deleteOne({ _id: objId }).exec();
    Utils.recordAction(
      'Delete',
      'Topic',
      args.swagger.params.auth_payload.preferred_username,
      objId
    );
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};
