const { remove, indexOf, assignIn } = require('lodash');
const defaultLog = require('winston').loggers.get('defaultLog');
const mongoose = require('mongoose');
const Actions = require('../helpers/actions');
const Utils = require('../helpers/utils');

/**
 * Ensure that no unwanted fields are being passed with a request.
 * 
 * @param {array} fields The fields to strip.
 * @returns {array}
 */
const getSanitizedFields = (fields) => {
  return remove(fields, (f) => {
    return (indexOf([
        '_schemaName',
        'name',
        'order',
        'project',
        'read',
        'write',
        'delete'
    ], f) !== -1);
  });
};

/**
 * Get the document sections options.
 * 
 * @param {object} args The arguments used to get the route options.
 * @param {HTTPResponse} res The response used for the HTTP route.
 * @returns {object}
 */
exports.protectedOptions = (args, res) => {
    defaultLog.info('DOCUMENT SECTION PROTECTED OPTIONS');
    res.status(200).send();
};

/**
 * Get the document sections for a given project.
 * 
 * @param {object} args The arguments used to save the section.
 * @param {HTTPResponse} res The response used for the HTTP route.
 * @returns {object}
 */
exports.protectedGet = async (args, res) => {
  defaultLog.info('DOCUMENT SECTION PROTECTED GET');
  const query = {};

  // Build match query if on project's id
  if (args.swagger.params.project && args.swagger.params.project.value) {
    assignIn(query, { project: mongoose.Types.ObjectId(args.swagger.params.project.value) });
  }

  // Set query type
  assignIn(query, { '_schemaName': 'DocumentSection' });

  try {
    const data = await Utils.runDataQuery('DocumentSection',
      args.swagger.params.auth_payload.client_roles,
      args.swagger.params.auth_payload.idir_user_guid,
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null,   // sort warmup
      null,   // sort
      null,   // skip
      null,  // limit
      null); // count

    Utils.recordAction(
      'Get',
      'DocumentSection',
      args.swagger.params.auth_payload.preferred_username,
      null
    );
    defaultLog.info('Got document section(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

/**
 * Get the document sections for a given project.
 * 
 * @param {object} args The arguments used to save the section.
 * @param {HTTPResponse} res The response used for the HTTP route.
 * @returns {object}
 */
exports.publicGet = async(args, res) => {
  defaultLog.info('DOCUMENT SECTION PUBLIC GET');
  const query = {};

  // Build match query if on project's id
  if (args.swagger.params.project && args.swagger.params.project.value) {
    assignIn(query, { project: mongoose.Types.ObjectId(args.swagger.params.project.value) });
  }

  // Set query type
  assignIn(query, { '_schemaName': 'DocumentSection' });

  try {
    const data = await Utils.runDataQuery('DocumentSection',
      ['public'],
      null,
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null,   // sort warmup
      null,   // sort
      null,   // skip
      null,  // limit
      null); // count

    Utils.recordAction('Get', 'DocumentSection', 'public', args.swagger.params.project && args.swagger.params.project.value ? args.swagger.params.project.value : null);

    defaultLog.info('Got document section(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
}

/**
 * Save a new document section.
 * 
 * @param {object} args The arguments used to save the section.
 * @param {HTTPResponse} res The response used for the HTTP route.
 * @returns {object}
 */
exports.protectedPost = async (args, res) => {
  defaultLog.info('DOCUMENT SECTION PROTECTED POST');
  const obj = args.swagger.params.documentSection.value;

  defaultLog.info('Incoming new document section:', obj);

  const DocumentSection = mongoose.model('DocumentSection');

  const documentSection = new DocumentSection({
    _schemaName: 'DocumentSection',
    name: obj.name,
    project: obj.project,
    order: obj.order,
    read: ['public', 'staff', 'sysadmin'],
    write: ['staff', 'sysadmin'],
    delete: ['staff', 'sysadmin']
  });

  try {
    const docSectionResult = await documentSection.save();
    Utils.recordAction(
      'Post',
      'DocumentSection',
      args.swagger.params.auth_payload.preferred_username,
      docSectionResult._id
      );
    defaultLog.info('Saved new document section object:', docSectionResult._id);
    return Actions.sendResponse(res, 200, docSectionResult);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

/**
 * Reorder the array of all document sections by updating the "order"
 * properties of each.
 * 
 * @param {object} args The arguments used to save the section.
 * @param {HTTPResponse} res The response used for the HTTP route.
 * @returns {object}
 */
exports.protectedReorder = async (args, res) => {
  defaultLog.info('DOCUMENT SECTION PROTECTED REORDER');
  const docSections = args.swagger.params.documentSections.value;

  defaultLog.info('Incoming new document sections:', docSections);

  const DocumentSection = mongoose.model('DocumentSection');
  const updatedSections = [];
  try {
    for (const section of docSections) {
      const updatedDocSection = await DocumentSection.findByIdAndUpdate(
        section._id,
        { order: section.order },
        { new: true, returnDocument: "after" }
      );
      updatedSections.push(updatedDocSection);
    }

    Utils.recordAction(
      'Reorder',
      'DocumentSection',
      args.swagger.params.auth_payload.preferred_username,
      null
    );
    defaultLog.info('Reordered document sections:', updatedSections);
    return Actions.sendResponse(res, 200, updatedSections);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
    
}
