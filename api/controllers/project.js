const { assignIn, remove, each, indexOf } = require('lodash');
const defaultLog = require('winston').loggers.get('defaultLog');
const mongoose = require('mongoose');
const qs = require('qs');
const Actions = require('../helpers/actions');
const Utils = require('../helpers/utils');
const tagList = [
  'existingLandUsePlans',
  'centroid',
  'description',
  'details',
  'engagementStatus',
  'logos',
  'shapefiles',
  'backgroundInfo',
  'backgroundImage',
  'engagementLabel',
  'engagementInfo',
  'documentInfo',
  'overlappingRegionalDistricts',
  'name',
  'partner',
  'region',
  'shapeFileColour',
  'projectDirector',
  'agreements',
  'addedBy',
  'existingLandUsePlanURLs',
  'code',
  'eaDecision',
  'operational',
  'commodity',
  'currentPhaseName',
  'dateAdded',
  'dateCommentsClosed',
  'dateCommentsOpen',
  'dateUpdated',
  'duration',
  'eaoMember',
  'epicProjectID',
  'fedElecDist',
  'isTermsAgreed',
  'overallProgress',
  'primaryContact',
  'proMember',
  'provElecDist',
  'shortName',
  'projectPhase',
  'projectTypes',
  'substitution',
  'updatedBy',
  'projectLead',
  'projectDirector',
  'read',
  'write',
  'delete',
  'activitiesAndUpdatesEnabled',
  'contactFormEnabled',
  'contactFormFilesEnabled',
  'contactFormEmails',
  'collectionNotice',
];

/**
 * Get all project fields.
 * 
 * @param {*} fields 
 * @returns 
 */
const getSanitizedFields = (fields) => {
  return remove(fields, (f) => {
    return indexOf(tagList, f) !== -1;
  });
};

/**
 * Options for projects.
 * 
 * @param {object} args 
 * @param {HTTPResponse} res 
 */
exports.protectedOptions = (_, res) => {
  defaultLog.info('PROJECT PROTECED OPTIONS');
  res.status(200).send();
};

/**
 * Public head request.
 * 
 * @param {object} args 
 * @param {HTTPResponse} res 
 */
exports.publicHead = async (args, res) => {
  defaultLog.info('PROJECT PUBLIC HEAD');

  // Build match query if on ProjId route
  let query = {};
  let commentPeriodPipeline = null;

  // Add in the default fields to the projection so that the incoming query will work for any selected fields.
  tagList.push('dateAdded');
  tagList.push('dateCompleted');

  const requestedFields = getSanitizedFields(args.swagger.params.fields.value);

  if (args.swagger.params.projId && args.swagger.params.projId.value) {
    query = Utils.buildQuery('_id', args.swagger.params.projId.value, query);
    commentPeriodPipeline = handleCommentPeriodForBannerQueryParameters(
      args,
      args.swagger.params.projId.value
    );
  } else {
    try {
      query = addStandardQueryFilters(query, args);
    } catch (e) {
      defaultLog.error('Document section protected head failed', {
        message: e && e.message,
        stack: e && e.stack,
      });
      return Actions.sendResponse(res, 400, e);
    }
  }

  // Set query type
  assignIn(query, { _schemaName: 'Project' });

  try {
    const data = await Utils.runDataQuery(
      'Project',
      ['public'],
      false,
      query,
      requestedFields, // Fields
      null, // sort warmup
      null, // sort
      null, // skip
      1000000, // limit
      true, // count
      null,
      false,
      commentPeriodPipeline
    );
    // /api/comment/ route, return 200 OK with 0 items if necessary
    if (
      !(args.swagger.params.projId && args.swagger.params.projId.value) ||
      (data && data.length > 0)
    ) {
      Utils.recordAction(
        'Head',
        'Project',
        'public',
        args.swagger.params.projId && args.swagger.params.projId.value
          ? args.swagger.params.projId.value
          : null
      );
      res.setHeader(
        'x-total-count',
        data && data.length > 0 ? data[0].total_items : 0
      );
      defaultLog.info('Got project headers: ', data);
      return Actions.sendResponse(res, 200, data);
    } else {
      defaultLog.info('Could not retrieve project headers.');
      return Actions.sendResponse(res, 404, data);
    }
  } catch (e) {
    defaultLog.error('Project public head failed', {
      message: e && e.message,
      stack: e && e.stack,
    });
    return Actions.sendResponse(res, 400, e);
  }
};

/**
 * Public get of projects.
 *
 * @param {object} args
 * @param {HTTPResponse} res
 * @returns
 */
exports.publicGet = async (args, res) => {
  defaultLog.info('PROJECT PUBLIC GET');
  // Build match query if on projId route
  let query = {},
    skip = null,
    limit = null,
    commentPeriodPipeline = null;

  const requestedFields = getSanitizedFields(args.swagger.params.fields.value);
  // Add in the default fields to the projection so that the incoming query will work for any selected fields.
  tagList.push('dateAdded');
  tagList.push('dateCompleted');

  if (args.swagger.params.projId && args.swagger.params.projId.value) {
    query = Utils.buildQuery('_id', args.swagger.params.projId.value, query);
    commentPeriodPipeline = handleCommentPeriodForBannerQueryParameters(
      args,
      args.swagger.params.projId.value
    );
  } else {
    // Could be a bunch of results - enable pagination
    const processedParameters = Utils.getSkipLimitParameters(
      args.swagger.params.pageSize,
      args.swagger.params.pageNum
    );
    skip = processedParameters.skip;
    limit = processedParameters.limit;

    try {
      query = addStandardQueryFilters(query, args);
    } catch (e) {
      defaultLog.info('Error getting projects, project public get failed.', {
        message: e && e.message,
        stack: e && e.stack,
      });
      return Actions.sendResponse(res, 400, e);
    }
  }

  // Set query type
  assignIn(query, { _schemaName: 'Project' });

  try {
    const data = await Utils.runDataQuery(
      'Project',
      ['public'],
      false,
      query,
      requestedFields, // Fields
      null, // sort warmup
      null, // sort
      skip, // skip
      limit, // limit
      false, // count
      null, // steps
      false, // proponent populate,
      true, //proj lead
      true, // proj director
      commentPeriodPipeline
    );

    // TODO: We should do this as a query
    if (commentPeriodPipeline) {
      each(data, (item) => {
        if (
          item.commentPeriodForBanner.length > 0 &&
          !item.commentPeriodForBanner[0].read.includes('public')
        ) {
          delete item.commentPeriodForBanner;
        }
      });
    }
    //serializeProjectVirtuals(data);
    Utils.recordAction(
      'Get',
      'Project',
      'public',
      args.swagger.params.projId && args.swagger.params.projId.value
        ? args.swagger.params.projId.value
        : null
    );
    defaultLog.info('Got projects: ', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error('Project public get failed', {
      message: e && e.message,
      stack: e && e.stack,
    });
    return Actions.sendResponse(res, 400, e);
  }
};

/**
 * Protected get of a project or projects.
 *
 * @param {object} args
 * @param {HTTPResponse} res
 * @returns
 */
exports.protectedGet = async (args, res) => {
  defaultLog.info('PROJECT PROTECTED GET');

  const params = args.swagger.params;
  let skip = null;
  let limit = null;
  let sort = null;
  let count = false;
  let query = {};
  let commentPeriodPipeline = null;

  // Only admins get this.
  if (params.fields.value) {
    params.fields.value.push('directoryStructure');
  }

  const fields = getSanitizedFields(params.fields.value);

  tagList.push('dateStarted');
  tagList.push('dateCompleted');

  if (
    params.projId &&
    'undefined' !== params.projId.value
  ) {
    // Getting a single project.
    assignIn(query, {
      _id: mongoose.Types.ObjectId(params.projId.value),
    });
    commentPeriodPipeline = handleCommentPeriodForBannerQueryParameters(
      args,
      params.projId.value
    );
  } else {
    // Getting multiple projects.
    try {
      // Filters.
      query = addStandardQueryFilters(query, args);

      // Sorting
      if (params.sortBy && params.sortBy.value) {
        sort = {};
        params.sortBy.value.forEach((value) => {
          const order_by = value.charAt(0) == '-' ? -1 : 1;
          const sort_by = value.slice(1);
          sort[sort_by] = order_by;
        });
      }

      // Pagination
      const processedParameters = Utils.getSkipLimitParameters(
        params.pageSize,
        params.pageNum,
      );
      skip = processedParameters.skip;
      limit = processedParameters.limit;

      // Enable Count
      count = true;
    } catch (e) {
      defaultLog.error('Error getting projects in project protected get.', {
        message: e && e.message,
        stack: e && e.stack,
      });
      return Actions.sendResponse(res, 400, e);
    }
  }

  // Set query type
  assignIn(query, { _schemaName: 'Project' });

  defaultLog.info('*****************************************');
  defaultLog.info('query:', query);
  defaultLog.info('*****************************************');

  defaultLog.info('PIPELINE', commentPeriodPipeline);

  try {
    const data = await Utils.runDataQuery(
      'Project',
      params.auth_payload.client_roles,
      params.auth_payload.idir_user_guid,
      query,
      fields, // Fields
      null, // sort warmup
      sort, // sort
      skip, // skip
      limit, // limit
      count, // count
      null, // pre query steps
      false, // pop proponent
      true, // pop projectLead
      true, // pop projectDirector
      commentPeriodPipeline
    );
    Utils.recordAction(
      'Get',
      'Project',
      params.auth_payload.preferred_username,
      params.projId && params.projId.value
        ? params.projId.value
        : null
    );
    //serializeProjectVirtuals(data);
    defaultLog.info('Got project(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error('Project protected get failed', {
      message: e && e.message,
      stack: e && e.stack,
    });
    return Actions.sendResponse(res, 400, e);
  }
};

/**
 * Handle a head api call.
 *
 * @param {object} args
 * @param {HTTPResponse} res
 */
exports.protectedHead = async (args, res) => {
  defaultLog.info('PROJECT PROTECTED HEAD');
  const params = args.swagger.params;

  // Build match query if on projId route
  let query = {};

  // Add in the default fields to the projection so that the incoming query will work for any selected fields.
  tagList.push('_id');
  tagList.push('tags');

  if (params.projId && params.projId.value) {
    query = Utils.buildQuery('_id', params.projId.value, query);
  } else {
    try {
      query = addStandardQueryFilters(query, args);
    } catch (e) {
      defaultLog.error('Project protected head failed', {
        message: e && e.message,
        stack: e && e.stack,
      });
      return Actions.sendResponse(res, 400, e);
    }
  }

  // Unless they specifically ask for it, hide deleted results.
  if (
    params.isDeleted &&
    params.isDeleted.value !== undefined
  ) {
    assignIn(query, { isDeleted: params.isDeleted.value });
  }

  // Set query type
  assignIn(query, { _schemaName: 'Project' });

  try {
    const data = await Utils.runDataQuery(
      'Project',
      args.swagger.operation['x-security-scopes'],
      query,
      tagList, // Fields
      null, // sort warmup
      null, // sort
      null, // skip
      1000000, // limit
      true
    ); // count

    // Return 200 OK with 0 items if necessary.
    if (
      !(params.projId && params.projId.value) ||
      (data && data.length > 0)
    ) {
      Utils.recordAction(
        'Head',
        'Project',
        params.auth_payload.preferred_username,
        params.projId && params.projId.value
          ? params.projId.value
          : null
      );
      res.setHeader(
        'x-total-count',
        data && data.length > 0 ? data[0].total_items : 0
      );
      defaultLog.info('Got comment headers: ', data);
      return Actions.sendResponse(res, 200, data);
    } else {
      defaultLog.info('Could not retrieve comment headers.');
      return Actions.sendResponse(res, 404, data);
    }
  } catch (e) {
    defaultLog.error('Project protected head failed', {
      message: e && e.message,
      stack: e && e.stack,
    });
    return Actions.sendResponse(res, 400, e);
  }
};

/**
 * Delete project.
 *
 * @param {object} args
 * @param {HTTPResponse} res
 */
exports.protectedDelete = async (args, res) => {
  defaultLog.info('PROJECT PROTECTED DELETE');
  const projId = args.swagger.params.projId.value;
  defaultLog.info('Delete Project:', projId);

  const Project = mongoose.model('Project');
  try {
    const o = await Project.findOne({ _id: projId }).exec();
    if (o) {
      // Set the deleted flag.
      const deleted = await Actions.delete(o);
      Utils.recordAction(
        'Delete',
        'Project',
        args.swagger.params.auth_payload.preferred_username,
        projId,
      );
      defaultLog.info('Deleted project:', projId);
      return Actions.sendResponse(res, 200, deleted);
    } else {
      defaultLog.error("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  } catch (e) {
    defaultLog.error('Project protected delete failed', {
      message: e && e.message,
      stack: e && e.stack,
    });
    return Actions.sendResponse(res, 400, e);
  }
};

/**
 * Add a new project.
 *
 * @param {object} args
 * @param {HTTPRequest} res
 */
exports.protectedPost = async (args, res) => {
  defaultLog.info('PROJECT PROTECTED POST');

  const obj = args.swagger.params.project.value;

  defaultLog.info('Incoming new object:', obj);

  const Project = mongoose.model('Project');
  const project = new Project(obj);
  project.projectLead = mongoose.Types.ObjectId(obj.projectLead);
  project.projectDirector = mongoose.Types.ObjectId(obj.projectDirector);
  project.read = ['sysadmin', 'staff'];
  project.write = ['sysadmin', 'staff'];
  project.delete = ['sysadmin', 'staff'];
  project._createdBy = args.swagger.params.auth_payload.preferred_username;
  project.createdDate = Date.now();
  try {
    const theProject = await project.save();
    Utils.recordAction(
      'Post',
      'Project',
      args.swagger.params.auth_payload.preferred_username,
      theProject._id,
    );
    defaultLog.info('Created new project: ', theProject._id);
    return Actions.sendResponse(res, 200, theProject);
  } catch (e) {
    defaultLog.error('Project protected post failed', {
      message: e && e.message,
      stack: e && e.stack,
    });
    return Actions.sendResponse(res, 400, e);
  }
};

/**
 * Delete a project pin.
 *
 * @param {object} args
 * @param {HTTPResponse} res
 * @returns
 */
exports.protectedPinDelete = async (args, res) => {
  defaultLog.info('PROJECT PROTECTED PIN');
  const projId = args.swagger.params.projId.value;
  const pinId = args.swagger.params.pinId.value;
  defaultLog.info('Delete PIN: ', pinId, ' from Project:', projId);

  const Project = mongoose.model('Project');
  try {
    const data = await Project.updateOne(
      { _id: projId },
      { $pull: { pins: { $in: [mongoose.Types.ObjectId(pinId)] } } },
      { new: true }
    );
    Utils.recordAction(
      'Delete',
      'Pin',
      args.swagger.params.auth_payload.preferred_username,
      pinId
    );
    defaultLog.info('Deleted project pin: ', pinId);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.info('Project protected pin delete failed', {
      message: e && e.message,
      stack: e && e.stack,
    });
    return Actions.sendResponse(res, 404, {});
  }
};

/**
 * 
 */
const handleGetPins = async (
  projectId,
  roles,
  sortBy,
  pageSize,
  pageNum,
  username,
  res
) => {
  let skip = null,
    limit = null,
    sort = null,
    query = {};

  assignIn(query, { _schemaName: 'Project' });

  let fields = ['_id', 'pins', 'name', 'website', 'province'];

  // First get the project
  if (projectId && projectId.value) {
    // Getting a single project
    assignIn(query, { _id: mongoose.Types.ObjectId(projectId.value) });
    const data = await Utils.runDataQuery(
      'Project',
      roles,
      query,
      fields, // Fields
      null, // sort warmup
      null, // sort
      null, // skip
      null, // limit
      false, // count
      null,
      true,
      null
    );

    assignIn(query, { _schemaName: 'Organization' });

    const thePins = [];
    if (!data[0].pins) {
      return Actions.sendResponse(res, 200, [{ total_items: 0 }]);
    } else {
      data[0].pins.map((pin) => {
        thePins.push(mongoose.Types.ObjectId(pin));
      });
      query = { _id: { $in: thePins } };

      // Sort
      if (sortBy && sortBy.value) {
        sort = {};
        sortBy.value.forEach((value) => {
          const order_by = value.charAt(0) == '-' ? -1 : 1;
          const sort_by = value.slice(1);
          sort[sort_by] = order_by;
        });
      }

      // Skip and limit
      const processedParameters = Utils.getSkipLimitParameters(
        pageSize,
        pageNum
      );
      skip = processedParameters.skip;
      limit = processedParameters.limit;

      try {
        const orgData = await Utils.runDataQuery(
          'Organization',
          roles,
          query,
          fields, // Fields
          null,
          sort, // sort
          skip, // skip
          limit, // limit
          true
        ); // count
        Utils.recordAction(
          'Get',
          'Pin',
          username,
          projectId && projectId.value ? projectId.value : null
        );
        return Actions.sendResponse(res, 200, orgData);
      } catch (e) {
        defaultLog.error('Project handle get pins failed', {
          message: e && e.message,
          stack: e && e.stack,
        });
        return Actions.sendResponse(res, 400, e);
      }
    }
  } else {
    defaultLog.error('Error getting project');
    return Actions.sendResponse(res, 400, 'error');
  }
};

/**
 * Get project pin on public app.
 * 
 * @param {object} args 
 * @param {HTTPResponse} res 
 */
exports.publicPinGet = async (args, res) => {
  defaultLog.info('PROJECT PIN PUBLIC GET');
  await handleGetPins(
    args.swagger.params.projId,
    ['public'],
    args.swagger.params.sortBy,
    args.swagger.params.pageSize,
    args.swagger.params.pageNum,
    'public',
    res
  );
};

/**
 * Get project pin.
 * 
 * @param {object} args 
 * @param {HTTPResponse} res 
 */
exports.protectedPinGet = async (args, res) => {
  defaultLog.info('PROJECT PIN PROTECTED GET');
  await handleGetPins(
    args.swagger.params.projId,
    args.swagger.params.auth_payload.client_roles,
    args.swagger.params.sortBy,
    args.swagger.params.pageSize,
    args.swagger.params.pageNum,
    args.swagger.params.auth_payload.preferred_username,
    res
  );
};

exports.protectedAddPins = async (args, res) => {
  defaultLog.info('PROJECT PROTECTED ADD PINS');
  const objId = args.swagger.params.projId.value;
  defaultLog.info('ObjectID:', args.swagger.params.projId.value);

  const Project = mongoose.model('Project');
  // var pinsArr = args.swagger.params.pins.value;
  const pinsArr = [];
  args.swagger.params.pins.value.map((item) => {
    pinsArr.push(mongoose.Types.ObjectId(item));
  });

  // Add pins to pins existing
  const doc = await Project.updateOne(
    { _id: mongoose.Types.ObjectId(objId) },
    {
      $push: {
        pins: {
          $each: pinsArr,
        },
      },
    },
    { new: true }
  );
  if (doc) {
    Utils.recordAction(
      'Add',
      'Pin',
      args.swagger.params.auth_payload.preferred_username,
      objId
    );
    return Actions.sendResponse(res, 200, doc);
  } else {
    defaultLog.error('Error adding project pins');
    return Actions.sendResponse(res, 404, {});
  }
};

exports.protectedDeleteGroupMembers = async (args, res) => {
  defaultLog.info('PROJECT PROTECTED DELETE GROUP MEMBERS');
  const projId = args.swagger.params.projId.value;
  const groupId = args.swagger.params.groupId.value;
  const memberId = args.swagger.params.memberId.value;
  defaultLog.info(
    'Delete Group Member:',
    memberId,
    'from group:',
    groupId,
    ' from Project:',
    projId
  );

  const Project = mongoose.model('Group');
  try {
    const data = await Project.updateOne(
      { _id: groupId },
      { $pull: { members: { $in: [mongoose.Types.ObjectId(memberId)] } } },
      { new: true }
    );
    Utils.recordAction(
      'Delete',
      'GroupMember',
      args.swagger.params.auth_payload.preferred_username,
      data._id
    );
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.info('Project protected delete group members failed', {
      message: e && e.message,
      stack: e && e.stack,
    });
    return Actions.sendResponse(res, 404, {});
  }
};

exports.protectedAddGroupMembers = async (args, res) => {
  const projectId = args.swagger.params.projId.value;
  const groupId = args.swagger.params.groupId.value;
  defaultLog.info('ProjectID:', projectId);
  defaultLog.info('GroupId:', groupId);

  const Project = mongoose.model('Group');
  const membersArr = [];
  args.swagger.params.members.value.map((item) => {
    membersArr.push(mongoose.Types.ObjectId(item));
  });

  // Add members to members existing
  const doc = await Project.updateOne(
    { _id: mongoose.Types.ObjectId(groupId) },
    {
      $push: {
        members: {
          $each: membersArr,
        },
      },
    },
    { new: true }
  );
  if (doc) {
    Utils.recordAction(
      'Add',
      'GroupMember',
      args.swagger.params.auth_payload.preferred_username,
      doc._id
    );
    return Actions.sendResponse(res, 200, doc);
  } else {
    defaultLog.info("Couldn't find that object!");
    return Actions.sendResponse(res, 404, {});
  }
};

exports.protectedGroupGetMembers = async (args, res) => {
  await handleGetGroupMembers(
    args.swagger.params.groupId,
    args.swagger.params.auth_payload.client_roles,
    args.swagger.params.sortBy,
    args.swagger.params.pageSize,
    args.swagger.params.pageNum,
    args.swagger.params.auth_payload.preferred_username,
    res
  );
};

const handleGetGroupMembers = async (
  groupId,
  roles,
  sortBy,
  pageSize,
  pageNum,
  username,
  res
) => {
  let skip = null,
    limit = null,
    sort = null;
  let query = {};

  assignIn(query, { _schemaName: 'Group' });

  let fields = ['_id', 'members', 'name', 'project'];

  // First get the group
  if (groupId && groupId.value) {
    // Getting a single group
    assignIn(query, { _id: mongoose.Types.ObjectId(groupId.value) });

    const data = await Utils.runDataQuery(
      'Group',
      roles,
      query,
      fields, // Fields
      null, // sort warmup
      null, // sort
      null, // skip
      null, // limit
      false, // count
      null,
      false,
      null
    );

    defaultLog.info('users:', data);

    if (data.length === 0) {
      return Actions.sendResponse(res, 200, [{total_items: 0}]);
    } else {
      assignIn(query, { _schemaName: 'User' });

      const theUsers = [];
      data[0].members.map((user) => {
        theUsers.push(mongoose.Types.ObjectId(user));
      });
      query = { _id: { $in: theUsers } };

      // Sort
      if (sortBy && sortBy.value) {
        sort = {};
        sortBy.value.forEach((value) => {
          const order_by = value.charAt(0) == '-' ? -1 : 1;
          const sort_by = value.slice(1);
          sort[sort_by] = order_by;
        });
      }

      // Skip and limit
      const processedParameters = Utils.getSkipLimitParameters(
        pageSize,
        pageNum
      );
      skip = processedParameters.skip;
      limit = processedParameters.limit;

      fields = ['_id', 'displayName', 'email', 'org', 'orgName', 'phoneNumber'];
      try {
        const groupData = await Utils.runDataQuery(
          'User',
          roles,
          query,
          fields, // Fields
          null,
          sort, // sort
          skip, // skip
          limit, // limit
          false
        ); // count
        Utils.recordAction('Get', 'GroupMember', username);
        return Actions.sendResponse(res, 200, groupData);
      } catch (e) {
        defaultLog.info('Project handle get group members failed', {
          message: e && e.message,
          stack: e && e.stack,
        });
        return Actions.sendResponse(res, 400, e);
      }
    }
  } else {
    return Actions.sendResponse(res, 400, 'error');
  }
};

exports.protectedAddGroup = async (args, res) => {
  const objId = args.swagger.params.projId.value;
  const groupName = args.swagger.params.group.value;
  defaultLog.info('Incoming new group:', groupName);

  const Group = mongoose.model('Group');
  const doc = new Group({
    project: mongoose.Types.ObjectId(objId),
    name: groupName.group,
  });
  ['sysadmin', 'sysadmin', 'staff'].forEach((item) => {
    doc.read.push(item);
    doc.write.push(item);
    doc.delete.push(item);
  });
  // Update who did this?
  doc._addedBy = args.swagger.params.auth_payload.preferred_username;
  try {
    const d = await doc.save();
    Utils.recordAction(
      'Add',
      'Group',
      args.swagger.params.auth_payload.preferred_username,
      objId
    );
    defaultLog.info('Saved new group object:', d);
    return Actions.sendResponse(res, 200, d);
  } catch (e) {
    defaultLog.error('Project protected add group failed', {
      message: e && e.message,
      stack: e && e.stack,
    });
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedGroupPut = async (args, res) => {
  const projId = args.swagger.params.projId.value;
  const groupId = args.swagger.params.groupId.value;
  const obj = args.swagger.params.groupObject.value;
  defaultLog.info('Update Group:', groupId, 'from project:', projId);

  const Group = mongoose.model('Group');
  try {
    const group = await Group.findOneAndUpdate({ _id: groupId }, obj, {
      upsert: false,
      new: true
    });
    Utils.recordAction(
      'Put',
      'Group',
      args.swagger.params.auth_payload.preferred_username,
      groupId
    );
    return Actions.sendResponse(res, 200, group);
  } catch (e) {
    defaultLog.error('Project protected group put failed', {
      message: e && e.message,
      stack: e && e.stack,
    });
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedGroupDelete = async (args, res) => {
  const objId = args.swagger.params.projId.value;
  const groupId = args.swagger.params.groupId.value;
  defaultLog.info('Delete Group:', groupId, 'from project:', objId);

  const Group = mongoose.model('Group');
  try {
    const doc = await Group.findOneAndRemove({ _id: groupId });
    defaultLog.info('deleting group', doc);
    Utils.recordAction(
      'Delete',
      'Group',
      args.swagger.params.auth_payload.preferred_username,
      objId
    );
    return Actions.sendResponse(res, 200, {});
  } catch (e) {
    defaultLog.error('Project protected group delete failed', {
      message: e && e.message,
      stack: e && e.stack,
    });
    return Actions.sendResponse(res, 400, e);
  }
};

/**
 * Update an existing project.
 *
 * @param {*} args
 * @param {*} res
 * @returns
 */
exports.protectedPut = async (args, res) => {
  defaultLog.info('PROJECT PROTECTED PUT');
  const objId = args.swagger.params.projId.value;
  defaultLog.info('Project to update:', args.swagger.params.projId.value);

  const Project = mongoose.model('Project');
  const projectObj = args.swagger.params.ProjObject.value;

  delete projectObj.read;
  delete projectObj.write;
  delete projectObj.delete;

  const obj = {
    agreements: projectObj.agreements,
    description: projectObj.description,
    details: projectObj.details,
    overlappingRegionalDistricts: projectObj.overlappingRegionalDistricts,
    region: projectObj.region,
    shapeFileColour: projectObj.shapeFileColour,
    projectPhase: projectObj.projectPhase,
    projectTypes: projectObj.projectTypes,
    name: projectObj.name,
    centroid: projectObj.centroid,
    projectLead: projectObj.projectLead,
    projectDirector: projectObj.projectDirector,
    existingLandUsePlans: projectObj.existingLandUsePlans,
    existingLandUsePlanURLs: projectObj.existingLandUsePlanURLs,
    engagementStatus: projectObj.engagementStatus,
    logos: projectObj.logos,
    shapefiles: projectObj.shapefiles,
    backgroundInfo: projectObj.backgroundInfo,
    backgroundImage: projectObj.backgroundImage,
    engagementLabel: projectObj.engagementLabel,
    engagementInfo: projectObj.engagementInfo,
    documentInfo: projectObj.documentInfo,
    partner: projectObj.partner,
    activitiesAndUpdatesEnabled: projectObj.activitiesAndUpdatesEnabled,
    contactFormEnabled: projectObj.contactFormEnabled,
    contactFormFilesEnabled: projectObj.contactFormFilesEnabled,
    contactFormEmails: projectObj.contactFormEmails,
    collectionNotice: projectObj.collectionNotice
  };

  const doc = await Project.findOneAndUpdate(
    { _id: mongoose.Types.ObjectId(objId) },
    obj,
    { upsert: false, new: true }
  );

  if (doc) {
    Utils.recordAction(
      'Put',
      'Project',
      args.swagger.params.auth_payload.preferred_username,
      objId
    );
    return Actions.sendResponse(res, 200, doc);
  } else {
    defaultLog.info("Couldn't find that object!");
    return Actions.sendResponse(res, 404, {});
  }
};

// Publish/Unpublish the project
exports.protectedPublish = async (args, res) => {
  defaultLog.info('PROJECT PROTECTED PUBLISH');
  const objId = args.swagger.params.projId.value;
  defaultLog.info('Publish Project:', objId);

  const Project = mongoose.model('Project');
  try {
    const o = await Project.findOne({ _id: objId }).exec();
    if (o) {
      const published = await Actions.publish(o);
      Utils.recordAction(
        'Publish',
        'Project',
        args.swagger.params.auth_payload.preferred_username,
        objId,
      );
      defaultLog.info('Project published: ', objId);
      return Actions.sendResponse(res, 200, published);
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  } catch (e) {
    defaultLog.error('Project protected publish failed', {
      message: e && e.message,
      stack: e && e.stack,
    });
    return Actions.sendResponse(res, 500, e);
  }
};

exports.protectedUnPublish = async (args, res) => {
  defaultLog.info('PROJECT PROTECTED UNPUBLISH');
  const objId = args.swagger.params.projId.value;
  defaultLog.info('UnPublish Project:', objId);

  const Project = mongoose.model('Project');
  try {
    const o = await Project.findOne({ _id: objId }).exec();
    if (o) {
      const unpublished = await Actions.unPublish(o);
      Utils.recordAction(
        'Put',
        'Unpublish',
        args.swagger.params.auth_payload.preferred_username,
        objId,
      );
      defaultLog.info('Unpublished project:', unpublished);
      return Actions.sendResponse(res, 200, unpublished);
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  } catch (e) {
    defaultLog.error('Project protected unpublish failed', {
      message: e && e.message,
      stack: e && e.stack,
    });
    return Actions.sendResponse(res, 500, e);
  }
};

const handleCommentPeriodForBannerQueryParameters = (args, projectId) => {
  if (
    args.swagger.params.cpStart &&
    args.swagger.params.cpStart.value !== undefined &&
    args.swagger.params.cpEnd &&
    args.swagger.params.cpEnd.value !== undefined
  ) {
    let dateStartedRange,
      dateCompletedRange,
      currentDateInBetween = null;
    const queryStringStart = qs.parse(args.swagger.params.cpStart.value);
    const queryStringEnd = qs.parse(args.swagger.params.cpEnd.value);

    if (queryStringStart.since && queryStringEnd.until) {
      dateStartedRange = {
        $and: [
          { dateStarted: { $gte: new Date(queryStringStart.since) } },
          { dateStarted: { $lte: new Date(queryStringEnd.until) } },
        ],
      };
      dateCompletedRange = {
        $and: [
          { dateCompleted: { $gte: new Date(queryStringStart.since) } },
          { dateCompleted: { $lte: new Date(queryStringEnd.until) } },
        ],
      };
      currentDateInBetween = {
        $and: [
          { dateStarted: { $lte: new Date(queryStringStart.since) } },
          { dateCompleted: { $gte: new Date(queryStringEnd.until) } },
        ],
      };
    } else {
      return null;
    }

    const match = {
      _schemaName: 'CommentPeriod',
      project: mongoose.Types.ObjectId(projectId),
      $or: [dateStartedRange, dateCompletedRange, currentDateInBetween],
    };

    return {
      $lookup: {
        from: 'lup',
        pipeline: [
          {
            $match: match,
          },
        ],
        as: 'commentPeriodForBanner',
      },
    };
  } else {
    return null;
  }
};

const addStandardQueryFilters = (query, args) => {
  const params = args.swagger.params;
  if (params.publishDate && params.publishDate.value !== undefined) {
    const queryString = qs.parse(params.publishDate.value);
    if (queryString.since && queryString.until) {
      // Combine queries as logical AND for the dataset.
      assignIn(query, {
        $and: [
          {
            publishDate: { $gte: new Date(queryString.since) },
          },
          {
            publishDate: { $lte: new Date(queryString.until) },
          },
        ],
      });
    } else if (queryString.eq) {
      assignIn(query, {
        publishDate: { $eq: new Date(queryString.eq) },
      });
    } else {
      // Which param was set?
      if (queryString.since) {
        assignIn(query, {
          publishDate: { $gte: new Date(queryString.since) },
        });
      }
      if (queryString.until) {
        assignIn(query, {
          publishDate: { $lte: new Date(queryString.until) },
        });
      }
    }
  }
  if (params.tantalisId && params.tantalisId.value !== undefined) {
    assignIn(query, { tantalisID: args.swagger.params.tantalisId.value });
  }
  if (params.cl_file && params.cl_file.value !== undefined) {
    assignIn(query, { cl_file: args.swagger.params.cl_file.value });
  }
  if (params.purpose && params.purpose.value !== undefined) {
    const queryString = qs.parse(params.purpose.value);
    let queryArray = [];
    if (Array.isArray(queryString.eq)) {
      queryArray = queryString.eq;
    } else {
      queryArray.push(queryString.eq);
    }
    assignIn(query, { purpose: { $in: queryArray } });
  }
  if (params.subpurpose && params.subpurpose.value !== undefined) {
    const queryString = qs.parse(args.swagger.params.subpurpose.value);
    let queryArray = [];
    if (Array.isArray(queryString.eq)) {
      queryArray = queryString.eq;
    } else {
      queryArray.push(queryString.eq);
    }
    assignIn(query, { subpurpose: { $in: queryArray } });
  }
  if (params.type && params.type.value !== undefined) {
    assignIn(query, { type: params.type.value });
  }
  if (params.subtype && params.subtype.value !== undefined) {
    assignIn(query, { subtype: params.subtype.value });
  }
  if (params.status && params.status.value !== undefined) {
    const queryString = qs.parse(params.status.value);
    let queryArray = [];
    if (Array.isArray(queryString.eq)) {
      queryArray = queryString.eq;
    } else {
      queryArray.push(queryString.eq);
    }
    assignIn(query, { status: { $in: queryArray } });
  }
  if (params.agency && params.agency.value !== undefined) {
    assignIn(query, { agency: params.agency.value });
  }
  if (params.businessUnit && params.businessUnit.value !== undefined) {
    assignIn(query, { businessUnit: params.businessUnit.value });
  }
  if (params.client && params.client.value !== undefined) {
    assignIn(query, { client: params.client.value });
  }
  if (params.tenureStage && params.tenureStage.value !== undefined) {
    assignIn(query, { tenureStage: params.tenureStage.value });
  }
  if (params.areaHectares && params.areaHectares.value !== undefined) {
    const queryString = qs.parse(params.areaHectares.value);
    if (queryString.gte && queryString.lte) {
      // Combine queries as logical AND to compute a Rnage of values.
      assignIn(query, {
        $and: [
          {
            areaHectares: { $gte: parseFloat(queryString.gte, 10) },
          },
          {
            areaHectares: { $lte: parseFloat(queryString.lte, 10) },
          },
        ],
      });
    } else if (queryString.eq) {
      // invalid or not specified, treat as equal
      assignIn(query, {
        areaHectares: { $eq: parseFloat(queryString.eq, 10) },
      });
    } else {
      // Which param was set?
      if (queryString.gte) {
        assignIn(query, {
          areaHectares: { $gte: parseFloat(queryString.gte, 10) },
        });
      }
      if (queryString.lte) {
        assignIn(query, {
          areaHectares: { $lte: parseFloat(queryString.lte, 10) },
        });
      }
    }
  }
  if (params.centroid && params.centroid.value !== undefined) {
    // defaultLog.info("Looking up features based on coords:", args.swagger.params.centroid.value);
    // Throws if parsing fails.
    assignIn(query, {
      centroid: {
        $geoIntersects: {
          $geometry: {
            type: 'Polygon',
            coordinates: JSON.parse(params.centroid.value),
          },
        },
      },
    });
  }
  // Allows filtering of apps that have had their last status change greater than this epoch time.
  if (params.statusHistoryEffectiveDate && params.statusHistoryEffectiveDate !== undefined) {
    const queryString = qs.parse(params.statusHistoryEffectiveDate.value);
    assignIn(query, {
      $or: [
        { statusHistoryEffectiveDate: null },
        { statusHistoryEffectiveDate: { $gte: parseInt(queryString.gte, 10) } },
      ],
    });
  }
  return query;
};
