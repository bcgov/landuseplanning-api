const _ = require('lodash');
const defaultLog = require('winston').loggers.get('defaultLog');
const mongoose = require('mongoose');
const Actions = require('../helpers/actions');
const Utils = require('../helpers/utils');

const tagList = [
  'code',
  'description',
  'name',
  'parent',
  'pillar',
  'project',
  'stage',
  'title',
  'type',
];

const getSanitizedFields = (fields) => {
  return _.remove(fields, (f) => {
    return _.indexOf(tagList, f) !== -1;
  });
};

exports.protectedOptions = (args, res) => {
  res.status(200).send();
};

//  Create a new vc
exports.protectedPost = async (args, res) => {
  const obj = args.swagger.params.vc.value;

  defaultLog.info('Incoming new object:', obj);

  const Vc = mongoose.model('Vc');
  const vc = new Vc({
    ...obj,
    _schemaName: 'Vc',
    read: ['public', 'sysadmin', 'staff'],
    write: ['sysadmin', 'staff'],
    delete: ['sysadmin', 'staff'],
  });

  try {
    // Define security tag defaults
    const theVc = await vc.save();
    Utils.recordAction(
      'Post',
      'Vc',
      args.swagger.params.auth_payload.preferred_username,
      theVc._id
    );
    return Actions.sendResponse(res, 200, theVc);
  } catch (e) {
    return Actions.sendResponse(res, 400, e, 'VC protected post failed');
  }
};

exports.protectedGet = async (args, res) => {
  let skip = null,
    limit = null,
    sort = {},
    query = {};
  const params = args.swagger.params;

  if (params.vcId && params.vcId.value) {
    query = Utils.buildQuery('_id', params.vcId.value, query);
  }
  if (params.projectId && params.projectId.value) {
    _.assignIn(query, {
      project: mongoose.Types.ObjectId(params.projectId.value),
    });
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
  _.assignIn(query, { _schemaName: 'Vc' });

  try {
    const data = await Utils.runDataQuery(
      'Vc',
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
      'Vc',
      params.auth_payload.preferred_username,
      params.vcId && params.vcId.value
        ? params.vcId.value
        : null
    );
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    return Actions.sendResponse(res, 400, e, 'VC protected get failed');
  }
};

exports.protectedPut = async (args, res) => {
  const objId = args.swagger.params.vcId.value;
  defaultLog.info('ObjectID:', objId);
  const obj = args.swagger.params.vc.value;

  // Strip security tags - these will not be updated on this route.
  delete obj.tags;

  defaultLog.info('Incoming updated object:', obj);

  const ValuedComponent = mongoose.model('Vc');

  try {
    const data = await ValuedComponent.findOneAndUpdate({ _id: objId }, obj, {
      upsert: false,
      new: true,
    }).exec();
    Utils.recordAction(
      'Put',
      'Vc',
      args.swagger.params.auth_payload.preferred_username,
      objId
    );
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    return Actions.sendResponse(res, 400, e, 'VC protected put failed');
  }
};

exports.protectedDelete = async (args, res) => {
  const objId = args.swagger.params.vcId.value;
  defaultLog.info('Delete Vc:', objId);

  const Vc = mongoose.model('Vc');

  try {
    const data = await Vc.deleteOne({ _id: objId }).exec();
    Utils.recordAction(
      'Delete',
      'Vc',
      args.swagger.params.auth_payload.preferred_username,
      objId
    );
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    return Actions.sendResponse(res, 400, e, 'VC protected delete failed');
  }
};
