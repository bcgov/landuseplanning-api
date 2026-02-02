const _ = require('lodash');
const defaultLog = require('winston').loggers.get('defaultLog');
const mongoose = require('mongoose');
const Actions = require('../helpers/actions');
const Utils = require('../helpers/utils');

const tagList = [
  'code',
  'description',
  'name',
  'companyType',
  'parentCompany'
];

const getSanitizedFields = (fields) => {
  return _.remove(fields, f => _.indexOf(tagList, f) !== -1);
};

exports.protectedOptions = (args, res) => {
  res.status(200).send();
};

exports.publicGet = async (args, res) => {
  const sort = {};
  let query = {};
  const params = args.swagger.params;

  if (params.orgId && params.orgId.value) {
    query = Utils.buildQuery('_id', params.orgId.value, query);
  }
  if (params.companyType && params.companyType.value) {
    _.assignIn(query, { companyType: params.companyType.value });
  }
  if (params.sortBy && params.sortBy.value) {
    params.sortBy.value.forEach(value => {
      const order_by = value.charAt(0) == '-' ? -1 : 1;
      const sort_by = value.slice(1);
      sort[sort_by] = order_by;
    });
  }

  // Set query type
  _.assignIn(query, { _schemaName: 'Organization' });

  try {
    const data = await Utils.runDataQuery(
      'Organization',
      ['public'], // Public role
      false, // Don't enter user sub when public.
      query, // Search query.
      getSanitizedFields(params.fields.value), // Fields
      null, // sort warmup
      sort, // sort
      null, // skip
      null, // limit
      false // count
    );
    Utils.recordAction(
      'Get',
      'Organization',
      'public',
      params.orgId && params.orgId.value
        ? params.orgId.value
        : null
    );
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    return Actions.sendResponse(res, 400, e, 'Organization public get failed');
  }
};

//  Create a new organization
exports.protectedPost = async (args, res) => {
  const obj = args.swagger.params.org.value;
  defaultLog.info('Incoming new object:', obj);

  const Organization = mongoose.model('Organization');

  const organization = new Organization({
    _schemaName: 'Organization',
    addedBy: args.swagger.params.auth_payload.preferred_username,
    description: obj.description,
    name: obj.name,
    updatedBy: args.swagger.params.auth_payload.preferred_username,
    dateAdded: new Date(),
    dateUpdated: new Date(),
    country: obj.country,
    postal: obj.postal,
    province: obj.province,
    city: obj.city,
    address1: obj.address1,
    address2: obj.address2,
    companyType: obj.companyType,
    parentCompany: mongoose.Types.ObjectId.isValid(obj.parentCompany)
      ? mongoose.Types.ObjectId(obj.parentCompany)
      : null,
    companyLegal: obj.companyLegal,
    company: obj.company,
    read: ['staff', 'sysadmin'],
    write: ['staff', 'sysadmin'],
    delete: ['staff', 'sysadmin']
  });

  try {
    const org = await organization.save();
    Utils.recordAction(
      'Post',
      'Organization',
      args.swagger.params.auth_payload.preferred_username,
      org._id
    );
    defaultLog.info('Saved new organization object:', org);
    return Actions.sendResponse(res, 200, org);
  } catch (e) {
    return Actions.sendResponse(
      res,
      400,
      e,
      'Organization protected post failed',
    );
  }
};

// Update an existing organization
exports.protectedPut = async (args, res) => {
  const objId = args.swagger.params.orgId.value;
  let obj = args.swagger.params.org.value;
  defaultLog.info("ObjectID:", args.swagger.params.orgId.value);

  const Organization = mongoose.model('Organization');

  const organization = {
    description: obj.description ? obj.description : '',
    name: obj.name ? obj.name : '',
    updatedBy: args.swagger.params.auth_payload.preferred_username,
    dateAdded: new Date(),
    dateUpdated: new Date(),
    country: obj.country ? obj.country : '',
    postal: obj.postal ? obj.postal : '',
    province: obj.province ? obj.province : '',
    city: obj.city ? obj.city : '',
    address1: obj.address1 ? obj.address1 : '',
    address2: obj.address2 ? obj.address2 : '',
    companyType: obj.companyType ? obj.companyType : '',
    parentCompany: mongoose.Types.ObjectId.isValid(obj.parentCompany)
      ? mongoose.Types.ObjectId(obj.parentCompany)
      : null,
    companyLegal: obj.companyLegal ? obj.companyLegal : '',
    company: obj.company ? obj.company : ''
  };

  defaultLog.info('Incoming updated object:', organization);

  try {
    const org = await Organization.findOneAndUpdate({ _id: objId }, obj, { upsert: false, new: true }).exec();
    Utils.recordAction('Put', 'Organization', args.swagger.params.auth_payload.preferred_username, objId);
    defaultLog.info('Organization updated:', org);
    return Actions.sendResponse(res, 200, org);
  } catch (e) {
    return Actions.sendResponse(
      res,
      400,
      e,
      'Organization protected put failed',
    );
  }
}

// Publish/Unpublish the organization
exports.protectedPublish = async (args, res) => {
  const objId = args.swagger.params.orgId.value;
  defaultLog.info('Publish Organization:', objId);

  const Organization = mongoose.model('Organization');
  try {
    const o = await Organization.findOne({ _id: objId }).exec();
    if (o) {
      Utils.recordAction(
        'Publish',
        'Organization',
        args.swagger.params.auth_payload.preferred_username,
        objId,
      );
      defaultLog.info('o:', o);
      // Add public to the tag of this obj.
      const published = await Actions.publish(o);
      return Actions.sendResponse(res, 200, published);
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  } catch (e) {
    return Actions.sendResponse(
      res,
      500,
      e,
      'Organization protected publish failed',
    );
  }
};

exports.protectedUnPublish = async (args, res) => {
  const objId = args.swagger.params.orgId.value;
  defaultLog.info('UnPublish Organization:', objId);

  const Organization = mongoose.model('Organization');
  try {
    const o = await Organization.findOne({ _id: objId }).exec();
    if (o) {
      defaultLog.info('o:', o);

      // Remove public to the tag of this obj.
      const unpublished = await Actions.unPublish(o);
      Utils.recordAction(
        'Unpublish',
        'Organization',
        args.swagger.params.auth_payload.preferred_username,
        objId,
      );
      // UnPublished successfully
      return Actions.sendResponse(res, 200, unpublished);
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  } catch (e) {
    return Actions.sendResponse(
      res,
      500,
      e,
      'Organization protected unpublish failed',
    );
  }
};

