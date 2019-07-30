var auth = require("../helpers/auth");
var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');

var getSanitizedFields = function (fields) {
  return _.remove(fields, function (f) {
    return (_.indexOf([
      '_schemaName',
      'dateUpdated',
      'dateAdded',
      'pinned',
      'documentUrl',
      'contentUrl',
      'type',
      'pcp',
      'active',
      'project',
      'content',
      'headline'
    ], f) !== -1);
  });
}
exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

exports.publicGet = async function (args, res, next) {
  var fields = ['_schemaName',
    'dateUpdated',
    'dateAdded',
    'pinned',
    'documentUrl',
    'contentUrl',
    'type',
    'pcp',
    'active',
    'project',
    'content',
    'headline'];
  var RecentActivity = mongoose.model('RecentActivity');
  var query = {};
  var sort = {
    dateAdded: -1
  };
  var theFields = getSanitizedFields(fields);

  _.assignIn(query, { '_schemaName': 'RecentActivity', active: true, pinned: true });

  try {
    var data = await Utils.runDataQuery('RecentActivity',
      ['public'],
      query,
      theFields, // Fields
      null, // sort warmup
      sort, // sort
      null, // skip
      4, // limit
      false,
      null,
      false,
      false,
      true); // count

    Utils.recordAction('Get', 'RecentActivity', 'public');

    if (data.length > 3) {
      // we're done getting enough for the front end. Top 4 only.
      return Actions.sendResponse(res, 200, data);
    } else {
      // Get next sorted, unpinned
      query = {};
      _.assignIn(query, { '_schemaName': 'RecentActivity', active: true, pinned: false });

      var dataNext = await Utils.runDataQuery('RecentActivity',
        ['public'],
        query,
        theFields, // Fields
        null, // sort warmup
        sort, // sort
        null, // skip
        4, // limit
        false,
        null,
        false,
        false,
        true); // count

      dataNext.slice(0, 4 - data.length).map(item => {
        data.push(item);
      });
      return Actions.sendResponse(res, 200, data);
    }

  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
}

exports.protectedDelete = function (args, res, next) {
  defaultLog.info("Deleting a RecentActivity(s)");
  defaultLog.info("args.swagger.params:", args.swagger.operation["x-security-scopes"]);

  var RecentActivity = mongoose.model('RecentActivity');
  var query = {};
  // Build match query if on recentActivityId route
  if (args.swagger.params.recentActivityId) {
    query = Utils.buildQuery("_id", args.swagger.params.recentActivityId.value, query);
  }

  if (!Object.keys(query).length > 0) {
    // Don't allow unilateral delete.
    return Actions.sendResponse(res, 400, "Can't delete entire collection.");
  }

  // Straight delete, don't isDelete=true them.
  RecentActivity.remove(query, function (err, data) {
    if (data) {
      Utils.recordAction('Delete', 'RecentActivity', args.swagger.params.auth_payload.preferred_username, data._id);
      return Actions.sendResponse(res, 200, data);
    } else {
      return Actions.sendResponse(res, 400, err);
    }
  });
}

//  Create a new RecentActivity
exports.protectedPost = async function (args, res, next) {
  var obj = args.swagger.params.recentActivity.value;
  defaultLog.info("Incoming new object:", obj);

  var RecentActivity = mongoose.model('RecentActivity');
  delete obj._id;
  var recentActivity = new RecentActivity(obj);
  // Define security tag defaults.  Default public and sysadmin.

  if (recentActivity.active) {
    recentActivity.read = ['sysadmin', 'staff', 'public'];
  } else {
    recentActivity.read = ['sysadmin', 'staff'];
  }

  recentActivity.pinned = false;

  recentActivity.dateAdded = new Date();
  recentActivity._addedBy = args.swagger.params.auth_payload.preferred_username;
  try {
    var rec = await recentActivity.save();
    Utils.recordAction('Post', 'RecentActivity', args.swagger.params.auth_payload.preferred_username, rec._id);
    defaultLog.info('Saved new RecentActivity object:', rec);
    return Actions.sendResponse(res, 200, rec);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

// Update an existing RecentActivity
exports.protectedPut = async function (args, res, next) {
  var objId = args.swagger.params.recentActivityId.value;
  defaultLog.info("ObjectID:", args.swagger.params.recentActivityId.value);

  var obj = args.swagger.params.RecentActivityObject.value;
  // Strip security tags - these will not be updated on this route.
  defaultLog.info("Incoming updated object:", obj);
  if (obj.active) {
    obj.read = ['sysadmin', 'staff', 'public'];
  } else {
    obj.read = ['sysadmin', 'staff'];
  }
  // TODO sanitize/update audits.
  obj._updatedBy = args.swagger.params.auth_payload.preferred_username;

  var RecentActivity = require('mongoose').model('RecentActivity');
  try {
    var rec = await RecentActivity.findOneAndUpdate({ _id: objId }, obj, { upsert: false });
    Utils.recordAction('Put', 'RecentActivity', args.swagger.params.auth_payload.preferred_username, rec._id);
    defaultLog.info('Updated RecentActivity object:', rec._id);
    return Actions.sendResponse(res, 200, rec);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
}
