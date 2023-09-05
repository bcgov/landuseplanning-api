const { remove, indexOf, assignIn } = require('lodash');
const defaultLog = require('winston').loggers.get('devLog');
const mongoose = require('mongoose');
const Actions = require('../helpers/actions');
const Utils = require('../helpers/utils');

const getSanitizedFields = (fields) => {
  return remove(fields, (f) => {
    return (indexOf([
        'name',
        'order',
        'project',
    ], f) !== -1);
  });
};

exports.protectedOptions = (args, res) => {
    defaultLog.info('DOCUMENT SECTION PROTECTED OPTIONS');
    res.status(200).send();
};

/**
 * 
 * @param {*} args 
 * @param {*} res 
 * @returns 
 */
exports.protectedGet = async function (args, res) {
  defaultLog.info('DOCUMENT SECTION PROTECTED GET');
  const query = {};

  // Build match query if on project's id
  if (args.swagger.params.project && args.swagger.params.project.value) {
    assignIn(query, { project: mongoose.Types.ObjectId(args.swagger.params.project.value) });
  }

  // Set query type
  assignIn(query, { '_schemaName': 'DocumentSection' });

  defaultLog.info(query, getSanitizedFields(args.swagger.params.fields.value))

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
 * 
 * @param {*} args 
 * @param {*} res 
 * @returns 
 */
exports.protectedPost = async function (args, res) {
    defaultLog.info('DOCUMENT SECTION PROTECTED POST');
    const obj = args.swagger.params.documentSection.value;
  
    defaultLog.info('Incoming new document section:', obj);
  
    const DocumentSection = mongoose.model('DocumentSection');
  
    const documentSection = new DocumentSection({
      _schemaName: 'DocumentSection',
      name: obj.name,
      project: obj.project,
      order: obj.order,
  
      read: ['staff', 'sysadmin'],
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