const _ = require('lodash');
const defaultLog = require('winston').loggers.get('defaultLog');
const mongoose = require('mongoose');
const Actions = require('../helpers/actions');
const Utils = require('../helpers/utils');
const tagList = ['listName', 'items'];

const getSanitizedFields = (fields = []) => {
  return _.remove(fields, (f) => _.indexOf(tagList, f) !== -1);
};

exports.protectedOptions = (args, res) => {
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
    _addedBy: args.swagger.params.auth_payload.preferred_username,
  });

  try {
    const saved = await topic.save();
    Utils.recordAction(
      'Post',
      'List',
      args.swagger.params.auth_payload.preferred_username,
      saved._id
    );
    return Actions.sendResponse(res, 200, saved);
  } catch (e) {
    return Actions.sendResponse(res, 400, e, 'List protected post failed');
  }
};

exports.protectedGet = async (args, res) => {
  const params = args.swagger.params;
  try {
    let skip = null,
      limit = null;
    const sort = {};
    let query = {};

    if (params.topicId && params.topicId.value) {
      query = Utils.buildQuery(
        '_id',
        params.topicId.value,
        query
      );
    }

    if (params.sortBy && params.sortBy.value) {
      params.sortBy.value.forEach((value) => {
        const order_by = value.charAt(0) === '-' ? -1 : 1;
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
    _.assignIn(query, { _schemaName: 'Topic' });

    const data = await Utils.runDataQuery(
      'Topic',
      params.auth_payload.client_roles,
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
      'List',
      params.auth_payload.preferred_username,
      params.topicId && params.topicId.value
        ? params.topicId.value
        : null
    );

    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    return Actions.sendResponse(res, 400, e, 'List protected get failed');
  }
};

exports.protectedPut = async (args, res) => {
  const objId = args.swagger.params.topicId.value;
  defaultLog.info('ObjectID:', objId);

  const obj = { ...args.swagger.params.cp.value };
  delete obj.tags; // Strip security tags - these will not be updated on this route.

  defaultLog.info('Incoming updated object:', obj);

  const Topic = mongoose.model('Topic');
  Topic._updatedBy = args.swagger.params.auth_payload.preferred_username;

  try {
    const updated = await Topic.findOneAndUpdate({ _id: objId }, obj, {
      upsert: false,
      new: true,
    }).exec();

    Utils.recordAction(
      'Put',
      'List',
      args.swagger.params.auth_payload.preferred_username,
      updated._id
    );
    return Actions.sendResponse(res, 200, updated);
  } catch (e) {
    return Actions.sendResponse(res, 400, e, 'List protected put failed');
  }
};

exports.protectedDelete = async (args, res) => {
  const objId = args.swagger.params.topicId.value;
  defaultLog.info('Delete Topic:', objId);

  const Topic = mongoose.model('Topic');

  try {
    const result = await Topic.deleteOne({ _id: objId });
    Utils.recordAction(
      'Delete',
      'List',
      args.swagger.params.auth_payload.preferred_username,
      objId
    );
    return Actions.sendResponse(res, 200, result);
  } catch (e) {
    return Actions.sendResponse(res, 400, e, 'List protected delete failed');
  }
};
