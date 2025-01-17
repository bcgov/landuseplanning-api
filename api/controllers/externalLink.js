const { remove, indexOf, assignIn } = require('lodash');
const defaultLog = require('winston').loggers.get('defaultLog');
const mongoose = require('mongoose');
const Actions = require('../helpers/actions');
const Utils = require('../helpers/utils');

const getSanitizedFields = (fields) => {
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
			'read',
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
	
  if (args.swagger.params.exLinkId && args.swagger.params.exLinkId.value) {
    query = Utils.buildQuery("_id", args.swagger.params.exLinkId.value, query);
  } else if (args.swagger.params.exLinkIds && args.swagger.params.exLinkIds.value && args.swagger.params.exLinkIds.value.length > 0) {
    query = Utils.buildQuery("_id", args.swagger.params.exLinkIds.value, query);
  }

  if (args.swagger.params.project && args.swagger.params.project.value) {
    query = Utils.buildQuery("project", args.swagger.params.project.value, query);
  }

  // Set query type
  assignIn(query, { "_schemaName": "ExternalLink" });

  try {
    const data = await Utils.runDataQuery(
			'ExternalLink',
      ['public'],
      null,
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null, // sort warmup
      null, // sort
      null, // skip
      null, // limit
      false); // count
    defaultLog.info('Got external link file(s):', data);
    Utils.recordAction('Get', 'ExternalLink', 'public', args.swagger.params.exLinkId ? args.swagger.params.exLinkId.value : null);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedHead = (args, res) => {
  defaultLog.info('EXTERNAL LINK PROTECTED HEAD');
  // Build match query if on exLinkId route
  let query = {};
  if (args.swagger.params.exLinkId && args.swagger.params.exLinkId.value) {
    query = Utils.buildQuery("_id", args.swagger.params.exLinkId.value, query);
  }
  if (args.swagger.params._application && args.swagger.params._application.value) {
    query = Utils.buildQuery('_application', args.swagger.params._application.value, query);
  }
  if (args.swagger.params._comment && args.swagger.params._comment.value) {
    query = Utils.buildQuery('_comment', args.swagger.params._comment.value, query);
  }
  // Set query type
  assignIn(query, { "_schemaName": "ExternalLink" });

  Utils.runDataQuery('ExternalLink',
    args.swagger.params.auth_payload.client_roles,
    args.swagger.params.auth_payload.idir_user_guid,
    query,
    ['_id',
      'read'], // Fields
    null, // sort warmup
    null, // sort
    null, // skip
    null, // limit
    true) // count
    .then((data) => {
      Utils.recordAction('Head', 'ExternalLink', args.swagger.params.auth_payload.preferred_username, args.swagger.params.exLinkId ? args.swagger.params.exLinkId.value : null);
      if (!(args.swagger.params.exLinkId && args.swagger.params.exLinkId.value) || (data && data.length > 0)) {
        res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items : 0);
        return Actions.sendResponse(res, 200, data);
      } else {
        return Actions.sendResponse(res, 404, data);
      }
    });
}

exports.protectedGet = async (args, res) => {
  defaultLog.info('EXTERNAL LINK PROTECTED GET');
  let query = {}, sort = {}, skip = null, limit = null, count = false;

  // Build match query if on exLinkId route
  if (args.swagger.params.exLinkId && args.swagger.params.exLinkId.value) {
    assignIn(query, { _id: mongoose.Types.ObjectId(args.swagger.params.exLinkId.value) });
  } else if (args.swagger.params.exLinkIds && args.swagger.params.exLinkIds.value && args.swagger.params.exLinkIds.value.length > 0) {
    query = Utils.buildQuery("_id", args.swagger.params.exLinkIds.value);
  }
  if (args.swagger.params.project && args.swagger.params.project.value) {
    query = Utils.buildQuery("project", args.swagger.params.project.value, query);
  }
  // Set query type
  assignIn(query, { "_schemaName": "ExternalLink" });

  try {
    const data = await Utils.runDataQuery('ExternalLink',
      args.swagger.params.auth_payload.client_roles,
      args.swagger.params.auth_payload.idir_user_guid,
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null, // sort warmup
      sort, // sort
      skip, // skip
      limit, // limit
      count); // count
    Utils.recordAction('Get', 'ExternalLink', args.swagger.params.auth_payload.preferred_username, args.swagger.params.exLinkId ? args.swagger.params.exLinkId.value : null);
    defaultLog.info('Got external file(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedPost = async (args, res, next) => {
  defaultLog.info('EXTERNAL LINK PROTECTED POST');
  try {
    const project = args.swagger.params.project && args.swagger.params.project.value;
		defaultLog.info('Section value:', args.swagger.params.section ? args.swagger.params.section.value : null);
    Promise.resolve()
      .then(async () => {
				const ExternalLink = mongoose.model('ExternalLink');
				const extLink = new ExternalLink();
				// Define security tag defaults
				extLink.read = ['sysadmin', 'staff'];
				extLink.write = ['sysadmin', 'staff'];
				extLink.delete = ['sysadmin', 'staff'];

				// Map the form values
				extLink.project = mongoose.Types.ObjectId(project);
				extLink._addedBy = args.swagger.params.auth_payload.preferred_username;
				extLink._createdDate = new Date();
				extLink.displayName = args.swagger.params.displayName.value;
				extLink.externalLink = args.swagger.params.externalLink.value;
				extLink.section = args.swagger.params.section ? args.swagger.params.section.value : null;
				extLink.dateAdded = args.swagger.params.dateAdded.value;
				extLink.dateUpdated = args.swagger.params.dateUpdated.value;
				extLink.description = args.swagger.params.description.value;
				extLink.projectPhase = args.swagger.params.projectPhase.value;
				extLink.checkbox = 'true' === args.body.checkbox ? true : false;
				extLink.save()
					.then((exl) => {
						Utils.recordAction('Post', 'ExternalLink', args.swagger.params.auth_payload.preferred_username, exl._id);
						return Actions.sendResponse(res, 200, exl);
					})
					.catch((error) => {
						defaultLog.error(error);
						return Actions.sendResponse(res, 400, error);
					});
			})
    .catch(error => defaultLog.error(error));
  } catch (e) {
    defaultLog.error(e);
    // Delete the path details before we return to the caller.
    delete e['path'];
    return Actions.sendResponse(res, 500, e);
  }
};

exports.protectedPublish = async (args, res) => {
  defaultLog.info('EXTERNAL LINK PROTECTED PUBLISH');
  const objId = args.swagger.params.exLinkId.value;
  defaultLog.info("Publish External Link:", objId);

  const ExternalLink = require('mongoose').model('ExternalLink');
  try {
    const exLink = await ExternalLink.findOne({ _id: objId });
    if (exLink) {
      defaultLog.info("External Link:", exLink);
      const published = await Actions.publish(await exLink.save());
      Utils.recordAction('Publish', 'ExternalLink', args.swagger.params.auth_payload.preferred_username, objId);
      return Actions.sendResponse(res, 200, published);
    } else {
      defaultLog.info("Couldn't find that external link!");
      return Actions.sendResponse(res, 404, e);
    }
  } catch (e) {
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedUnPublish = async (args, res) => {
  defaultLog.info('EXTERNAL LINK PROTECTED UNPUBLISH');
  const objId = args.swagger.params.exLinkId.value;
  defaultLog.info("Unpublish External Link:", objId);
  const ExternalLink = require('mongoose').model('ExternalLink');
  try {
    const exLink = await ExternalLink.findOne({ _id: objId });
    if (exLink) {
      const unPublished = await Actions.unPublish(await exLink.save());
      Utils.recordAction('Unpublish', 'ExternalLink', args.swagger.params.auth_payload.preferred_username, objId);
      defaultLog.info("Published external link:", objId);
      return Actions.sendResponse(res, 200, unPublished);
    } else {
      defaultLog.info("Couldn't find that external link!");
      return Actions.sendResponse(res, 404, e);
    }
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedPut = async (args, res) => {
  defaultLog.info('EXTERNAL LINK PROTECTED PUT');
  const objId = args.swagger.params.exLinkId.value;
  let obj = {};
  defaultLog.info('Put external link:', objId);

  obj._updatedBy = args.swagger.params.auth_payload.preferred_username;
  obj.displayName = args.swagger.params.displayName.value;
	obj.externalLink = args.swagger.params.externalLink.value;
  obj.section = args.swagger.params.section.value;
  obj.projectPhase = args.swagger.params.projectPhase.value;
  obj.dateAdded = args.swagger.params.dateAdded.value;
  obj.dateUpdated = args.swagger.params.dateUpdated.value;
  obj.description = args.swagger.params.description.value;
  obj.section = "null" === args.swagger.params.section.value ? null : args.swagger.params.section.value;
  const ExternalLink = mongoose.model('ExternalLink');

  try {
    const exLink = await ExternalLink.findOneAndUpdate({ _id: objId }, obj, { upsert: false, new: true });
    if (exLink) {
      Utils.recordAction('put', 'ExternalLink', args.swagger.params.auth_payload.preferred_username, objId);
      defaultLog.info('External link updated:', objId);
      return Actions.sendResponse(res, 200, exLink);
    } else {
      defaultLog.info("Couldn't find that external link!");
      return Actions.sendResponse(res, 404, {});
    }
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
}

exports.protectedDelete = async (args, res) => {
  defaultLog.info('EXTERNAL LINK PROTECTED DELETE');
  const objId = args.swagger.params.exLinkId.value;
  defaultLog.info("Delete External Link:", objId);
  const ExternalLink = require('mongoose').model('ExternalLink');

  try {
    await ExternalLink.findOneAndRemove({ _id: objId });
    Utils.recordAction('Delete', 'ExternalLink', args.swagger.params.auth_payload.preferred_username, objId);
    return Actions.sendResponse(res, 200, {});
  } catch (e) {
    defaultLog.error("Error:", e);
    return Actions.sendResponse(res, 400, e);
  }
};
