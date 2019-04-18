var auth        = require("../helpers/auth");
var _           = require('lodash');
var defaultLog  = require('winston').loggers.get('default');
var mongoose    = require('mongoose');
var Actions     = require('../helpers/actions');
var Utils       = require('../helpers/utils');

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
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
  var recentActivity = new RecentActivity(obj);
  // Define security tag defaults.  Default public and sysadmin.
  recentActivity.read = ['project-system-admin', 'sysadmin'];
  recentActivity.dateAdded = new Date();
  recentActivity._addedBy = args.swagger.params.auth_payload.preferred_username;
  try {
    var rec = await recentActivity.save();
    Utils.recordAction('post', 'recentActivity', args.swagger.params.auth_payload.preferred_username, rec._id);
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
  // TODO sanitize/update audits.
  obj._updatedBy = args.swagger.params.auth_payload.preferred_username;

  var RecentActivity = require('mongoose').model('RecentActivity');
  try {
    var rec = await RecentActivity.findOneAndUpdate({_id: objId}, obj, {upsert:false, new: true});
    Utils.recordAction('put', 'recentActivity', args.swagger.params.auth_payload.preferred_username, rec._id);
    defaultLog.info('Updated RecentActivity object:', rec._id);
    return Actions.sendResponse(res, 200, rec);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
}
