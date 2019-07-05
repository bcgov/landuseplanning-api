var auth = require("../helpers/auth");
var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var qs = require('qs');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');
var request = require('request');
var tagList = [
  'CEAAInvolvement',
  'CELead',
  'CELeadEmail',
  'CELeadPhone',
  'centroid',
  'description',
  'eacDecision',
  'activeStatus',
  'location',
  'name',
  'projectLead',
  'projectLeadEmail',
  'projectLeadPhone',
  'proponent',
  'region',
  'responsibleEPD',
  'responsibleEPDEmail',
  'responsibleEPDPhone',
  'subtype',
  'type',
  'addedBy',
  'build',
  'intake',
  'CEAALink',
  'code',
  'eaDecision',
  'operational',
  'substantiallyStarted',
  'nature',
  'commodity',
  'currentPhaseName',
  'dateAdded',
  'dateCommentsClosed',
  'dateCommentsOpen',
  'dateUpdated',
  'decisionDate',
  'duration',
  'eaoMember',
  'epicProjectID',
  'fedElecDist',
  'isTermsAgreed',
  'overallProgress',
  'primaryContact',
  'proMember',
  'provElecDist',
  'sector',
  'shortName',
  'status',
  'substantiallyDate',
  'substantially',
  'substitution',
  'eaStatus',
  'eaStatusDate',
  'projectStatusDate',
  'activeDate',
  'updatedBy',
  'projLead',
  'execProjectDirector',
  'complianceLead',
  'read',
  'write',
  'delete'
];

var getSanitizedFields = function (fields) {
  return _.remove(fields, function (f) {
    return (_.indexOf(tagList, f) !== -1);
  });
}

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

exports.publicHead = async function (args, res, next) {
  defaultLog.info('Getting head for Project')

  // Build match query if on ProjId route
  var query = {};
  var commentPeriodPipeline = null;

  // Add in the default fields to the projection so that the incoming query will work for any selected fields.
  tagList.push('dateAdded');
  tagList.push('dateCompleted');

  var requestedFields = getSanitizedFields(args.swagger.params.fields.value);

  if (args.swagger.params.projId) {
    query = Utils.buildQuery("_id", args.swagger.params.projId.value, query);
    commentPeriodPipeline = handleCommentPeriodForBannerQueryParameters(args, args.swagger.params.projId.value);
  } else {
    try {
      query = addStandardQueryFilters(query, args);
    } catch (error) {
      return Actions.sendResponse(res, 400, { error: error.message });
    }
  }

  // Set query type
  _.assignIn(query, { "_schemaName": "Project" });

  try {
    var data = await Utils.runDataQuery('Project',
      ['public'],
      query,
      requestedFields, // Fields
      null, // sort warmup
      null, // sort
      null, // skip
      1000000, // limit
      true, // count
      null,
      false,
      commentPeriodPipeline);
    // /api/comment/ route, return 200 OK with 0 items if necessary
    if (!(args.swagger.params.projId && args.swagger.params.projId.value) || (data && data.length > 0)) {
      //Utils.recordAction('head', 'project', args.swagger.params.auth_payload.preferred_username);
      defaultLog.info('Got project head:', data);
      res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items : 0);
      return Actions.sendResponse(res, 200, data);
    } else {
      return Actions.sendResponse(res, 404, data);
    }
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.publicGet = async function (args, res, next) {
  // Build match query if on projId route
  var query = {}, skip = null, limit = null;
  var commentPeriodPipeline = null;

  var requestedFields = getSanitizedFields(args.swagger.params.fields.value);
  // Add in the default fields to the projection so that the incoming query will work for any selected fields.
  tagList.push('dateAdded');
  tagList.push('dateCompleted');

  if (args.swagger.params.projId) {
    query = Utils.buildQuery("_id", args.swagger.params.projId.value, query);
    commentPeriodPipeline = handleCommentPeriodForBannerQueryParameters(args, args.swagger.params.projId.value);
  } else {
    // Could be a bunch of results - enable pagination
    var processedParameters = Utils.getSkipLimitParameters(args.swagger.params.pageSize, args.swagger.params.pageNum);
    skip = processedParameters.skip;
    limit = processedParameters.limit;

    try {
      query = addStandardQueryFilters(query, args);
    } catch (error) {
      return Actions.sendResponse(res, 400, { error: error.message });
    }
  }

  // Set query type
  _.assignIn(query, { "_schemaName": "Project" });

  try {
    var data = await Utils.runDataQuery('Project',
      ['public'],
      query,
      requestedFields, // Fields
      null, // sort warmup
      null, // sort
      skip, // skip
      limit, // limit
      false, // count
      null, // steps
      true, // proponent populate
      commentPeriodPipeline);
    defaultLog.info('Got project(s):', data);

    // TODO: We should do this as a query
    if (commentPeriodPipeline) {
      _.each(data, function (item) {
        if (item.commentPeriodForBanner.length > 0 && !item.commentPeriodForBanner[0].read.includes('public')) {
          delete item.commentPeriodForBanner;
        }
      });
    }

    populateReadonlyNatureField(data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedGet = async function (args, res, next) {
  var skip = null, limit = null, sort = null;
  var count = false;
  var query = {};

  var commentPeriodPipeline = null;

  // Admin's only get this
  if (args.swagger.params.fields.value) {
    args.swagger.params.fields.value.push('directoryStructure');
  }
  var fields = getSanitizedFields(args.swagger.params.fields.value);

  tagList.push('dateStarted');
  tagList.push('dateCompleted');

  defaultLog.info("args.swagger.params:", args.swagger.operation["x-security-scopes"]);

  if (args.swagger.params.projId) {
    // Getting a single project
    _.assignIn(query, { _id: mongoose.Types.ObjectId(args.swagger.params.projId.value) });
    commentPeriodPipeline = handleCommentPeriodForBannerQueryParameters(args, args.swagger.params.projId.value);
    console.log(JSON.stringify(commentPeriodPipeline));
  } else {
    // Getting multiple projects
    try {
      // Filters
      query = addStandardQueryFilters(query, args);

      // Sorting
      if (args.swagger.params.sortBy && args.swagger.params.sortBy.value) {
        sort = {};
        args.swagger.params.sortBy.value.forEach(function (value) {
          var order_by = value.charAt(0) == '-' ? -1 : 1;
          var sort_by = value.slice(1);
          sort[sort_by] = order_by;
        }, this);
      }

      // Pagination
      var processedParameters = Utils.getSkipLimitParameters(args.swagger.params.pageSize, args.swagger.params.pageNum);
      skip = processedParameters.skip;
      limit = processedParameters.limit;

      // Enable Count
      count = true

    } catch (error) {
      return Actions.sendResponse(res, 400, { error: error.message });
    }
  }

  // Set query type
  _.assignIn(query, { "_schemaName": "Project" });

  console.log("*****************************************");
  console.log("query:", query);
  console.log("*****************************************");

  console.log("PIPELINE", commentPeriodPipeline);

  try {
    var data = await Utils.runDataQuery('Project',
      args.swagger.params.auth_payload.realm_access.roles,
      query,
      fields, // Fields
      null, // sort warmup
      sort, // sort
      skip, // skip
      limit, // limit
      count, // count
      null,
      true,
      commentPeriodPipeline);
    Utils.recordAction('get', 'project', args.swagger.params.auth_payload.preferred_username);
    populateReadonlyNatureField(data);
    defaultLog.info('Got comment project(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedHead = function (args, res, next) {
  defaultLog.info("args.swagger.params:", args.swagger.operation["x-security-scopes"]);

  // Build match query if on projId route
  var query = {};

  // Add in the default fields to the projection so that the incoming query will work for any selected fields.
  tagList.push('_id');
  tagList.push('tags');

  if (args.swagger.params.projId) {
    query = Utils.buildQuery("_id", args.swagger.params.projId.value, query);
  } else {
    try {
      query = addStandardQueryFilters(query, args);
    } catch (error) {
      return Actions.sendResponse(res, 400, { error: error.message });
    }
  }

  // Unless they specifically ask for it, hide deleted results.
  if (args.swagger.params.isDeleted && args.swagger.params.isDeleted.value !== undefined) {
    _.assignIn(query, { isDeleted: args.swagger.params.isDeleted.value });
  } else {

  }

  // Set query type
  _.assignIn(query, { "_schemaName": "Project" });

  Utils.runDataQuery('Project',
    args.swagger.operation["x-security-scopes"],
    query,
    tagList, // Fields
    null, // sort warmup
    null, // sort
    null, // skip
    1000000, // limit
    true) // count
    .then(function (data) {
      // /api/comment/ route, return 200 OK with 0 items if necessary
      if (!(args.swagger.params.projId && args.swagger.params.projId.value) || (data && data.length > 0)) {
        res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items : 0);
        return Actions.sendResponse(res, 200, data);
      } else {
        return Actions.sendResponse(res, 404, data);
      }
    });
};

populateReadonlyNatureField = function (data) {
  _.each(data, function (item) {
    if (item) {
      console.log("item.build = " + item.build);
      switch (item.build) {
        case 'new':
          item.nature = 'New Construction';
          break;
        case 'modification':
          item.nature = 'Modification of Existing';
          break;
        case 'dismantling':
          item.nature = 'Dismantling or Abandonment';
          break;
        default:
          item.nature = 'Unknown nature value';
      }
    }
  });
}

exports.protectedDelete = function (args, res, next) {
  var projId = args.swagger.params.projId.value;
  defaultLog.info("Delete Project:", projId);

  var Project = mongoose.model('Project');
  Project.findOne({ _id: projId }, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);

      // Set the deleted flag.
      Actions.delete(o)
        .then(function (deleted) {
          // Deleted successfully
          return Actions.sendResponse(res, 200, deleted);
        }, function (err) {
          // Error
          return Actions.sendResponse(res, 400, err);
        });
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
}

//  Create a new project
exports.protectedPost = function (args, res, next) {
  var obj = args.swagger.params.project.value;

  defaultLog.info("Incoming new object:", obj);

  var Project = mongoose.model('Project');
  var project = new Project(obj);
  // Define security tag defaults
  project.read = ['sysadmin', 'staff'];
  project.write = ['sysadmin', 'staff'];
  project.delete = ['sysadmin', 'staff'];
  project._createdBy = args.swagger.params.auth_payload.preferred_username;
  project.createdDate = Date.now();
  project.save()
    .then(function (theProject) {
      return Actions.sendResponse(res, 200, theProject);
    })
    .catch(function (err) {
      console.log("Error in API:", err);
      return Actions.sendResponse(res, 400, err);
    });
};

exports.protectedPinDelete = async function (args, res, next) {
  var projId = args.swagger.params.projId.value;
  var pinId = args.swagger.params.pinId.value;
  defaultLog.info("Delete PIN: ", pinId, " from Project:", projId);

  var Project = mongoose.model('Project');
  try {
    var data = await Project.update(
      { _id: projId },
      { $pull: { pins: { $in: [mongoose.Types.ObjectId(pinId)] } } },
      { new: true }
    );
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.info("Couldn't find that object!");
    return Actions.sendResponse(res, 404, {});
  }
}

handleGetPins = async function(projectId, roles, sortBy, pageSize, pageNum, username, res) {
  var skip = null, limit = null, sort = null;
  var count = false;
  var query = {};

  _.assignIn(query, { "_schemaName": "Project" });

  var fields = ['_id', 'pins', 'name', 'website', 'province'];

  // First get the project
  if (projectId) {
    // Getting a single project
    _.assignIn(query, { _id: mongoose.Types.ObjectId(projectId.value) });
    var data = await Utils.runDataQuery('Project',
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

    _.assignIn(query, { "_schemaName": "Organization" });

    let thePins = [];
    if (!data[0].pins) {
      // no pins, return empty result;
      return Actions.sendResponse(res, 200, [{
        total_items: 0
      }]);
    } else {
      data[0].pins.map( pin => {
        thePins.push(mongoose.Types.ObjectId(pin));
      })
      query = { _id: { $in: thePins }}

      // Sort
      if (sortBy && sortBy.value) {
        sort = {};
        sortBy.value.forEach(function (value) {
          var order_by = value.charAt(0) == '-' ? -1 : 1;
          var sort_by = value.slice(1);
          sort[sort_by] = order_by;
        }, this);
      }

      // Skip and limit
      var processedParameters = Utils.getSkipLimitParameters(pageSize, pageNum);
      skip = processedParameters.skip;
      limit = processedParameters.limit;

      try {
        var orgData = await Utils.runDataQuery('Organization',
        roles,
          query,
          fields, // Fields
          null,
          sort, // sort
          skip, // skip
          limit, // limit
          true); // count
        Utils.recordAction('get', 'organization', username);
        return Actions.sendResponse(res, 200, orgData);
      } catch (e) {
        defaultLog.info('Error:', e);
        return Actions.sendResponse(res, 400, e);
      }
    }
  } else {
    return Actions.sendResponse(res, 400, 'error');
  }
}

exports.publicPinGet = async function (args, res, next) {
  handleGetPins(args.swagger.params.projId,
    ['public'],
    args.swagger.params.sortBy,
    args.swagger.params.pageSize,
    args.swagger.params.pageNum,
    'public',
    res
    );
}

exports.protectedPinGet = async function (args, res, next) {
  handleGetPins(args.swagger.params.projId,
    args.swagger.params.auth_payload.realm_access.roles,
    args.swagger.params.sortBy,
    args.swagger.params.pageSize,
    args.swagger.params.pageNum,
    args.swagger.params.auth_payload.preferred_username,
    res
    );
}

exports.protectedAddPins = async function (args, res, next) {
  var objId = args.swagger.params.projId.value;
  defaultLog.info("ObjectID:", args.swagger.params.projId.value);

  var Project = mongoose.model('Project');
  // var pinsArr = args.swagger.params.pins.value;
  var pinsArr = [];
  args.swagger.params.pins.value.map(item => {
    pinsArr.push(mongoose.Types.ObjectId(item));
  });

  // Add pins to pins existing
  var doc = await Project.update(
    { _id: mongoose.Types.ObjectId(objId) },
    {
      $push: {
        pins: {
          $each: pinsArr
        }
      }
    },
    { new: true }
  );
  if (doc) {
    return Actions.sendResponse(res, 200, doc);
  } else {
    defaultLog.info("Couldn't find that object!");
    return Actions.sendResponse(res, 404, {});
  }
}

// Update an existing project
exports.protectedPut = async function (args, res, next) {
  var objId = args.swagger.params.projId.value;
  defaultLog.info("ObjectID:", args.swagger.params.projId.value);

  var Project = mongoose.model('Project');
  var obj = {};
  var projectObj = args.swagger.params.ProjObject.value;

  // console.log("Incoming updated object:", projectObj);
  console.log("*****************");

  delete projectObj.read;
  delete projectObj.write;
  delete projectObj.delete;

  obj.type = projectObj.type;
  obj.build = projectObj.build;
  obj.sector = projectObj.sector;
  obj.description = projectObj.description;
  obj.location = projectObj.location;
  obj.region = projectObj.region;
  obj.status = projectObj.status;
  obj.eaStatus = projectObj.eaStatus;
  obj.name = projectObj.name;
  // obj.eaStatusDate = new Date(projectObj.eaStatusDate);
  // obj.projectStatusDate = new Date(projectObj.projectStatusDate);
  // obj.substantiallyDate = new Date(projectObj.substantiallyDate);
  // obj.activeDate = new Date(projectObj.activeDate);
  obj.substantially = projectObj.substantially;

  obj.centroid = projectObj.centroid;

  // Contacts
  obj.projLead = projectObj.projLead;
  obj.execProjectDirector = projectObj.execProjectDirector;
  obj.complianceLead = projectObj.complianceLead;

  obj.CEAAInvolvement = projectObj.CEAAInvolvement;
  obj.CEAALink = projectObj.CEAALink;
  obj.eacDecision = projectObj.eacDecision;
  if (projectObj.decisionDate) {
    obj.decisionDate = new Date(projectObj.decisionDate);
  }

  try {
    obj.intake = {};
    obj.intake.investment = projectObj.intake.investment;
    obj.intake.investmentNotes = projectObj.intake.notes;
  } catch (e) {
    // Missing info
    console.log("Missing:", e);
    // fall through
  }
  // Not doing people or proponent yet.
  // obj.proponent;

  console.log("Updating with:", obj);
  console.log("--------------------------");
  var doc = await Project.findOneAndUpdate({ _id: mongoose.Types.ObjectId(objId) }, obj, { upsert: false, new: true });
  // Project.update({ _id: mongoose.Types.ObjectId(objId) }, { $set: updateObj }, function (err, o) {
  if (doc) {
    console.log("o:", doc);
    return Actions.sendResponse(res, 200, doc);
  } else {
    defaultLog.info("Couldn't find that object!");
    return Actions.sendResponse(res, 404, {});
  }
}

// Publish/Unpublish the project
exports.protectedPublish = function (args, res, next) {
  var objId = args.swagger.params.projId.value;
  defaultLog.info("Publish Project:", objId);

  var Project = require('mongoose').model('Project');
  Project.findOne({ _id: objId }, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);
      return Actions.publish(o)
        .then(function (published) {
          return Actions.sendResponse(res, 200, published);
        })
        .catch(function (err) {
          return Actions.sendResponse(res, err.code, err);
        });
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
};
exports.protectedUnPublish = function (args, res, next) {
  var objId = args.swagger.params.projId.value;
  defaultLog.info("UnPublish Project:", objId);

  var Project = require('mongoose').model('Project');
  Project.findOne({ _id: objId }, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);
      return Actions.unPublish(o)
        .then(function (unpublished) {
          return Actions.sendResponse(res, 200, unpublished);
        })
        .catch(function (err) {
          return Actions.sendResponse(res, err.code, err);
        });
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
};

var handleCommentPeriodForBannerQueryParameters = function (args, projectId) {
  if (args.swagger.params.cpStart && args.swagger.params.cpStart.value !== undefined && args.swagger.params.cpEnd && args.swagger.params.cpEnd.value !== undefined) {
    var dateStartedRange, dateCompletedRange, currentDateInBetween = null;
    var queryStringStart = qs.parse(args.swagger.params.cpStart.value);
    var queryStringEnd = qs.parse(args.swagger.params.cpEnd.value);

    if (queryStringStart.since && queryStringEnd.until) {
      dateStartedRange = { $and: [{ dateStarted: { $gte: new Date(queryStringStart.since) } }, { dateStarted: { $lte: new Date(queryStringEnd.until) } }] };
      dateCompletedRange = { $and: [{ dateCompleted: { $gte: new Date(queryStringStart.since) } }, { dateCompleted: { $lte: new Date(queryStringEnd.until) } }] };
      currentDateInBetween = { $and: [{ dateStarted: { $lte: new Date(queryStringStart.since) } }, { dateCompleted: { $gte: new Date(queryStringEnd.until) } }] };
    } else {
      return null;
    }

    var match = {
      _schemaName: 'CommentPeriod',
      project: mongoose.Types.ObjectId(projectId),
      $or: [dateStartedRange, dateCompletedRange, currentDateInBetween]
    };

    return {
      '$lookup':
      {
        from: 'epic',
        pipeline: [{
          $match: match
        }],
        as: 'commentPeriodForBanner'
      }
    };
  } else {
    return null;
  }
}


var addStandardQueryFilters = function (query, args) {
  if (args.swagger.params.publishDate && args.swagger.params.publishDate.value !== undefined) {
    var queryString = qs.parse(args.swagger.params.publishDate.value);
    if (queryString.since && queryString.until) {
      // Combine queries as logical AND for the dataset.
      _.assignIn(query, {
        $and: [
          {
            publishDate: { $gte: new Date(queryString.since) }
          },
          {
            publishDate: { $lte: new Date(queryString.until) }
          }
        ]
      });
    } else if (queryString.eq) {
      _.assignIn(query, {
        publishDate: { $eq: new Date(queryString.eq) }
      });
    } else {
      // Which param was set?
      if (queryString.since) {
        _.assignIn(query, {
          publishDate: { $gte: new Date(queryString.since) }
        });
      }
      if (queryString.until) {
        _.assignIn(query, {
          publishDate: { $lte: new Date(queryString.until) }
        });
      }
    }
  }
  if (args.swagger.params.tantalisId && args.swagger.params.tantalisId.value !== undefined) {
    _.assignIn(query, { tantalisID: args.swagger.params.tantalisId.value });
  }
  if (args.swagger.params.cl_file && args.swagger.params.cl_file.value !== undefined) {
    _.assignIn(query, { cl_file: args.swagger.params.cl_file.value });
  }
  if (args.swagger.params.purpose && args.swagger.params.purpose.value !== undefined) {
    var queryString = qs.parse(args.swagger.params.purpose.value);
    var queryArray = [];
    if (Array.isArray(queryString.eq)) {
      queryArray = queryString.eq;
    } else {
      queryArray.push(queryString.eq);
    }
    _.assignIn(query, { purpose: { $in: queryArray } });
  }
  if (args.swagger.params.subpurpose && args.swagger.params.subpurpose.value !== undefined) {
    var queryString = qs.parse(args.swagger.params.subpurpose.value);
    var queryArray = [];
    if (Array.isArray(queryString.eq)) {
      queryArray = queryString.eq;
    } else {
      queryArray.push(queryString.eq);
    }
    _.assignIn(query, { subpurpose: { $in: queryArray } });
  }
  if (args.swagger.params.type && args.swagger.params.type.value !== undefined) {
    _.assignIn(query, { type: args.swagger.params.type.value });
  }
  if (args.swagger.params.subtype && args.swagger.params.subtype.value !== undefined) {
    _.assignIn(query, { subtype: args.swagger.params.subtype.value });
  }
  if (args.swagger.params.status && args.swagger.params.status.value !== undefined) {
    var queryString = qs.parse(args.swagger.params.status.value);
    var queryArray = [];
    if (Array.isArray(queryString.eq)) {
      queryArray = queryString.eq;
    } else {
      queryArray.push(queryString.eq);
    }
    _.assignIn(query, { status: { $in: queryArray } });
  }
  if (args.swagger.params.agency && args.swagger.params.agency.value !== undefined) {
    _.assignIn(query, { agency: args.swagger.params.agency.value });
  }
  if (args.swagger.params.businessUnit && args.swagger.params.businessUnit.value !== undefined) {
    _.assignIn(query, { businessUnit: args.swagger.params.businessUnit.value });
  }
  if (args.swagger.params.client && args.swagger.params.client.value !== undefined) {
    _.assignIn(query, { client: args.swagger.params.client.value });
  }
  if (args.swagger.params.tenureStage && args.swagger.params.tenureStage.value !== undefined) {
    _.assignIn(query, { tenureStage: args.swagger.params.tenureStage.value });
  }
  if (args.swagger.params.areaHectares && args.swagger.params.areaHectares.value !== undefined) {
    var queryString = qs.parse(args.swagger.params.areaHectares.value);
    if (queryString.gte && queryString.lte) {
      // Combine queries as logical AND to compute a Rnage of values.
      _.assignIn(query, {
        $and: [
          {
            areaHectares: { $gte: parseFloat(queryString.gte, 10) }
          },
          {
            areaHectares: { $lte: parseFloat(queryString.lte, 10) }
          }
        ]
      });
    } else if (queryString.eq) {
      // invalid or not specified, treat as equal
      _.assignIn(query, {
        areaHectares: { $eq: parseFloat(queryString.eq, 10) }
      });
    } else {
      // Which param was set?
      if (queryString.gte) {
        _.assignIn(query, {
          areaHectares: { $gte: parseFloat(queryString.gte, 10) }
        });
      }
      if (queryString.lte) {
        _.assignIn(query, {
          areaHectares: { $lte: parseFloat(queryString.lte, 10) }
        });
      }
    }
  }
  if (args.swagger.params.centroid && args.swagger.params.centroid.value !== undefined) {
    // defaultLog.info("Looking up features based on coords:", args.swagger.params.centroid.value);
    // Throws if parsing fails.
    _.assignIn(query, {
      centroid: { $geoIntersects: { $geometry: { type: "Polygon", coordinates: JSON.parse(args.swagger.params.centroid.value) } } }
    });
  }
  // Allows filtering of apps that have had their last status change greater than this epoch time.
  if (args.swagger.params.statusHistoryEffectiveDate && args.swagger.params.statusHistoryEffectiveDate !== undefined) {
    var queryString = qs.parse(args.swagger.params.statusHistoryEffectiveDate.value);
    _.assignIn(query, {
      $or: [{ statusHistoryEffectiveDate: null }, { statusHistoryEffectiveDate: { $gte: parseInt(queryString.gte, 10) } }]
    });
  }
  return query;
}
