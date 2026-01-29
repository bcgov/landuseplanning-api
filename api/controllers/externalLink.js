
'use strict';

const { remove, indexOf, assignIn } = require('lodash');
const defaultLog = require('winston').loggers.get('defaultLog');
const mongoose = require('mongoose');
const Actions = require('../helpers/actions');
const Utils = require('../helpers/utils');

const getSanitizedFields = (fields = []) => {
  return remove(fields, (f) => {
    return (indexOf([
      '_addedBy',
      'project',
      'displayName',
      'externalLink',
      'section',
      'dateAdded',
      'dateUpdated',
      'description',
      'projectPhase',
      'checkbox',
      'read'
    ], f) !== -1);
  });
};

exports.protectedOptions = (args, res) => {
  defaultLog.info('EXTERNAL LINK PROTECTED OPTIONS');
  res.status(200).send();
};

exports.publicGet = async (args, res) => {
  defaultLog.info('EXTERNAL LINK PUBLIC GET');
  // Build match query if on exLinkId route
  let query = {};
  const params = args.swagger.params;

  if (params.exLinkId && params.exLinkId.value) {
    query = Utils.buildQuery('_id', params.exLinkId.value, query);
  } else if (params.exLinkIds && params.exLinkIds.value && params.exLinkIds.value.length > 0) {
    query = Utils.buildQuery('_id', params.exLinkIds.value, query);
  }

  if (params.project && params.project.value) {
    query = Utils.buildQuery('project', params.project.value, query);
  }

  // Set query type
  assignIn(query, { _schemaName: 'ExternalLink' });

  try {
    const data = await Utils.runDataQuery(
      'ExternalLink',
      ['public'],
      null,
      query,
      getSanitizedFields(params.fields.value), // Fields
      null, // sort warmup
      null, // sort
      null, // skip
      null, // limit
      false // count
    );
    defaultLog.info('Got external link file(s):', data);
    Utils.recordAction('Get', 'ExternalLink', 'public', params.exLinkId ? params.exLinkId.value : null);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedHead = async (args, res) => {
  defaultLog.info('EXTERNAL LINK PROTECTED HEAD');
  // Build match query if on exLinkId route
  let query = {};
  const params = args.swagger.params;

  if (params.exLinkId && params.exLinkId.value) {
    query = Utils.buildQuery('_id', params.exLinkId.value, query);
  }
  if (params._application && params._application.value) {
    query = Utils.buildQuery('_application', params._application.value, query);
  }
  if (params._comment && params._comment.value) {
    query = Utils.buildQuery('_comment', params._comment.value, query);
  }
  // Set query type
  assignIn(query, { '_schemaName': 'ExternalLink' });

  try {
    const data = await Utils.runDataQuery(
      'ExternalLink',
      params.auth_payload.client_roles,
      params.auth_payload.idir_user_guid,
      query,
      ['_id', 'read'], // Fields
      null, // sort warmup
      null, // sort
      null, // skip
      null, // limit
      true  // count
    );

    Utils.recordAction('Head', 'ExternalLink', params.auth_payload.preferred_username, params.exLinkId ? params.exLinkId.value : null);
    if (!(params.exLinkId && params.exLinkId.value) || (data && data.length > 0)) {
      res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items : 0);
      return Actions.sendResponse(res, 200, data);
    } else {
      return Actions.sendResponse(res, 404, data);
    }
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedGet = async (args, res) => {
  defaultLog.info('EXTERNAL LINK PROTECTED GET');
  let query = {}, sort = {}, skip = null, limit = null, count = false;
  const params = args.swagger.params;

  // Build match query if on exLinkId route
  if (params.exLinkId && params.exLinkId.value) {
    assignIn(query, { _id: mongoose.Types.ObjectId(params.exLinkId.value) });
  } else if (params.exLinkIds && params.exLinkIds.value && params.exLinkIds.value.length > 0) {
    query = Utils.buildQuery('_id', params.exLinkIds.value);
  }
  if (params.project && params.project.value) {
    query = Utils.buildQuery('project', params.project.value, query);
  }
  // Set query type
  assignIn(query, { '_schemaName': 'ExternalLink' });

  try {
    const data = await Utils.runDataQuery(
      'ExternalLink',
      params.auth_payload.client_roles,
      params.auth_payload.idir_user_guid,
      query,
      getSanitizedFields(params.fields && params.fields.value), // Fields
      null, // sort warmup
      sort, // sort
      skip, // skip
      limit, // limit
      count  // count
    );
    Utils.recordAction('Get', 'ExternalLink', params.auth_payload.preferred_username, params.exLinkId ? params.exLinkId.value : null);
    defaultLog.info('Got external file(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedPost = async (args, res) => {
  defaultLog.info('EXTERNAL LINK PROTECTED POST');
  try {
    const project = args.swagger.params.project && args.swagger.params.project.value;
    defaultLog.info('Section value:', args.swagger.params.section ? args.swagger.params.section.value : null);
    const ExternalLink = mongoose.model('ExternalLink');
    const extLink = new ExternalLink({
      read: ['sysadmin', 'staff'],
      write: ['sysadmin', 'staff'],
      delete: ['sysadmin', 'staff'],
      project: mongoose.Types.ObjectId(project),
      _addedBy: args.swagger.params.auth_payload.preferred_username,
      _createdDate: new Date(),
      displayName: args.swagger.params.displayName.value,
      externalLink: args.swagger.params.externalLink.value,
      section: args.swagger.params.section ? args.swagger.params.section.value : null,
      dateAdded: args.swagger.params.dateAdded.value,
      dateUpdated: args.swagger.params.dateUpdated.value,
      description: args.swagger.params.description.value,
      projectPhase: args.swagger.params.projectPhase.value,
      checkbox: args.body.checkbox === 'true'
    });
    const exl = await extLink.save();
    Utils.recordAction('Post', 'ExternalLink', args.swagger.params.auth_payload.preferred_username, exl._id);
    return Actions.sendResponse(res, 200, exl);

  } catch (e) {
    defaultLog.error(e);
    // Delete the path details before we return to the caller.
    delete e.path;
    return Actions.sendResponse(res, 500, e);
  }
};

exports.protectedPublish = async (args, res) => {
  defaultLog.info('EXTERNAL LINK PROTECTED PUBLISH');
  const objId = args.swagger.params.exLinkId.value;
  defaultLog.info('Publish External Link:', objId);

  const ExternalLink = mongoose.model('ExternalLink');
  try {
    const exLink = await ExternalLink.findOne({ _id: objId });
    if (exLink) {
      defaultLog.info('External Link:', exLink);
      const published = await Actions.publish(await exLink.save());
      Utils.recordAction('Publish', 'ExternalLink', args.swagger.params.auth_payload.preferred_username, objId);
      return Actions.sendResponse(res, 200, published);
    } else {
      defaultLog.info('Couldn\'t find that external link!');
      return Actions.sendResponse(res, 404, { message: 'External link not found' });
    }
  } catch (e) {
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedUnPublish = async (args, res) => {
  defaultLog.info('EXTERNAL LINK PROTECTED UNPUBLISH');
  const objId = args.swagger.params.exLinkId.value;
  defaultLog.info('Unpublish External Link:', objId);
  const ExternalLink = mongoose.model('ExternalLink');
  try {
    const exLink = await ExternalLink.findOne({ _id: objId });
    if (exLink) {
      const unPublished = await Actions.unPublish(await exLink.save());
      Utils.recordAction('Unpublish', 'ExternalLink', args.swagger.params.auth_payload.preferred_username, objId);
      defaultLog.info('Published external link:', objId);
      return Actions.sendResponse(res, 200, unPublished);
    } else {
      defaultLog.info('Couldn\'t find that external link!');
      return Actions.sendResponse(res, 404, { message: 'External link not found' });
    }
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedPut = async (args, res) => {
  const params = args.swagger.params;
  defaultLog.info('EXTERNAL LINK PROTECTED PUT');
  const objId = params.exLinkId.value;
  defaultLog.info('Put external link:', objId);

  const obj = {
    _updatedBy: params.auth_payload.preferred_username,
    displayName: params.displayName.value,
    externalLink: params.externalLink.value,
    section: params.section.value === 'null'
      ? null
      : params.section.value,
    projectPhase: params.projectPhase.value,
    dateAdded: params.dateAdded.value,
    dateUpdated: params.dateUpdated.value,
    description: params.description.value
  };

  const ExternalLink = mongoose.model('ExternalLink');

  try {
    const exLink = await ExternalLink.findOneAndUpdate({ _id: objId }, obj, { upsert: false, new: true });
    if (exLink) {
      Utils.recordAction('put', 'ExternalLink', params.auth_payload.preferred_username, objId);
      defaultLog.info('External link updated:', objId);
      return Actions.sendResponse(res, 200, exLink);
    } else {
      defaultLog.info('Couldn\'t find that external link!');
      return Actions.sendResponse(res, 404, {});
    }
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedDelete = async (args, res) => {
  defaultLog.info('EXTERNAL LINK PROTECTED DELETE');
  const objId = args.swagger.params.exLinkId.value;
  defaultLog.info('Delete External Link:', objId);
  const ExternalLink = mongoose.model('ExternalLink');

  try {
    await ExternalLink.findOneAndRemove({ _id: objId });
    Utils.recordAction('Delete', 'ExternalLink', args.swagger.params.auth_payload.preferred_username, objId);
    return Actions.sendResponse(res, 200, {});
  } catch (e) {
    defaultLog.error('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};
