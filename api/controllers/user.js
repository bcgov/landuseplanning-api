var auth = require("../helpers/auth");
var _ = require('lodash');
var defaultLog = require('winston').loggers.get('defaultLog');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');

const getSanitizedFields = (fields) => {
  return _.remove(fields, (f) => {
    return (_.indexOf([
      'sub',
      'idirUserGuid',
      'firstName',
      'lastName',
      'displayName',
      'email',
      'projectPermissions'], f) !== -1);
  });
};

exports.protectedOptions = function (args, res) {
  defaultLog.info('USER PROTECTED OPTIONS');
  res.status(200).send();
}

exports.protectedGet = async function (args, res) {
  defaultLog.info('USER PROTECTED GET', args.swagger.params);

  let query = {}, sort = {}, skip = null, limit = null, count = false;

  // Build match query if on userId route. Query by user idirUserGuid so as to only get real users(not Contacts).
  if (args.swagger.params.userId && args.swagger.params.userId.value) {
    _.assignIn(query, { idirUserGuid: args.swagger.params.userId.value });
  }

  // Set query type
  _.assignIn(query, { "_schemaName": "User" });

  try {
    const data = await Utils.runDataQuery('User',
      args.swagger.params.auth_payload.client_roles,
      false, // User GUID not needed here as results should only get returned to 'create-projects' users.
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null, // sort warmup
      sort, // sort
      skip, // skip
      limit, // limit
      count); // count
    Utils.recordAction('Get', 'User', args.swagger.params.auth_payload.preferred_username, data[0] && data[0]._id ? data[0]._id.toString() : null);
    defaultLog.info('Got user(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedGetByEmail = async function (args, res) {
  defaultLog.info('USER PROTECTED GET BY EMAIL', args.swagger.params.userEmail);

  let query = {}, sort = {}, skip = null, limit = null, count = false;

  // Build match query if on userId route. Query by user guid so as to only get real users(not Contacts).
  if (args.swagger.params.userEmail && args.swagger.params.userEmail.value) {
    _.assignIn(query, { email: args.swagger.params.userEmail.value });
  }

  // Set query type
  _.assignIn(query, { "_schemaName": "User" });

  try {
    const data = await Utils.runDataQuery('User',
      args.swagger.params.auth_payload.client_roles,
      false, // User GUID not needed here as results should only get returned to 'create-projects' users.
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null, // sort warmup
      sort, // sort
      skip, // skip
      limit, // limit
      count); // count
    Utils.recordAction('Get', 'User', args.swagger.params.auth_payload.preferred_username, data[0] && data[0]._id ? data[0]._id.toString() : null);
    defaultLog.info('Got user(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

//  Create a new user
exports.protectedPost = async function (args, res) {
  defaultLog.info('USER PROTECTED POST');
  var obj = args.swagger.params.user.value;
  defaultLog.info("Incoming new object:", obj);

  var User = mongoose.model('User');
  var user = new User({
    firstName: obj.firstName,
    lastName: obj.lastName,
    displayName: obj.displayName,
    email: obj.email,
    idirUserGuid: obj.idirUserGuid,
    read: ['staff', 'sysadmin'],
    write: ['staff', 'sysadmin'],
    delete: ['staff', 'sysadmin']
  });

  // Make the user's password salted and store that instead of the actual password.
  user = auth.setPassword(user);

  try {
    var u = await user.save();
    Utils.recordAction('Put', 'User', args.swagger.params.auth_payload.preferred_username, u._id);
    defaultLog.info('Saved new user:', u._id);
    return Actions.sendResponse(res, 200, u._id);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

// Update an existing user
exports.protectedPut = async function (args, res) {
  defaultLog.info('USER PROTECTED PUT');
  var objId = args.swagger.params.userId.value;
  var obj = args.swagger.params.user.value;
  defaultLog.info("Put user:", args.swagger.params.userId.value);

  var User = require('mongoose').model('User');

  try {
    var u = await User.findOneAndUpdate({ _id: objId }, obj, { upsert: false, new: true }).exec();
    Utils.recordAction('Put', 'User', args.swagger.params.auth_payload.preferred_username, objId);
    defaultLog.info('User updated:', u._id);
    return Actions.sendResponse(res, 200, u);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
}

const addProjectPermission = async (user, projId) => {
  defaultLog.info(`Attempting to add user ${user} to project ${projId}'`);
  return new Promise((resolve, reject) => {
    if (!user.projectPermissions.includes(projId)) {
      user.projectPermissions.push(projId);
      defaultLog.info(`added project ${projId} to user`);
      resolve(user.save());
    } else {
      reject(`Cannot add project to user ${user.displayName}.`);
    }
  })
}

const removeProjectPermission = async (user, projId) => {
  defaultLog.info(`Attempting to remove user ${user} from project ${projId}'`);
  return new Promise((resolve, reject) => {
    if (user.projectPermissions.includes(projId)) {
      user.projectPermissions.pull(projId);
      defaultLog.info(`removed project ${projId} from user`);
      resolve(user.save());
    } else {
      reject(`Cannot remove project from user ${user.displayName}.`);
    }
  });
}

exports.protectedAddPermission = (args, res) => {
  defaultLog.info('USER PROTECTED ADD PERMISSION');
  const userId = mongoose.Types.ObjectId(args.swagger.params.userId.value);
  const projId = mongoose.Types.ObjectId(args.swagger.params.projId.value);
  const User = require('mongoose').model('User');

  // Find all users that have the idirUserGuid field(real users as opposed to Contacts).
  User.find({_schemaName: 'User', idirUserGuid: {$exists: true}}, (err, users) => {
    if (users) {
      users.forEach(user => {
        if (user._id.equals(userId)) {
          addProjectPermission(user, projId)
          .then((permissionAdded) => {
            Utils.recordAction('Add Permission', 'User', args.swagger.params.auth_payload.preferred_username, userId);
            defaultLog.info('Permission added to user', userId);
            // Return all users to be able to update list of users in Permissions tab.
            return Actions.sendResponse(res, 200, users);
          })
          .catch((err) => {
            defaultLog.error(err);
            return Actions.sendResponse(res, 500, err);
          });
        }
      })
    } else {
      defaultLog.info("Couldn't find user!");
      return Actions.sendResponse(res, 404, {});
    }
  })
};

exports.protectedRemovePermission = function (args, res) {
  defaultLog.info('USER PROTECTED REMOVE PERMISSION');
  const userId = mongoose.Types.ObjectId(args.swagger.params.userId.value);
  const projId = mongoose.Types.ObjectId(args.swagger.params.projId.value);
  const User = require('mongoose').model('User');

  // Find all users that have the idirUserGuid field(real users as opposed to Contacts).
  User.find({_schemaName: 'User', idirUserGuid: {$exists: true}}, (err, users) => {
    if (users) {
      users.forEach(user => {
        if (user._id.equals(userId)) {
          removeProjectPermission(user, projId)
          .then((permissionAdded) => {
            Utils.recordAction('Remove Permission', 'User', args.swagger.params.auth_payload.preferred_username, userId);
            defaultLog.info('Permission removed from user', userId);
            // Return all users to be able to update list of users in Permissions tab.
            return Actions.sendResponse(res, 200, users);
          })
          .catch((err) => {
            defaultLog.error(err);
            return Actions.sendResponse(res, 500, err);
          });
        }
      })
    } else {
      defaultLog.info("Couldn't find user!");
      return Actions.sendResponse(res, 404, {});
    }
  })
};
