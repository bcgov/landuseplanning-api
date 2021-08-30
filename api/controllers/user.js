var auth = require("../helpers/auth");
var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');

const getSanitizedFields = (fields) => {
  return _.remove(fields, (f) => {
    return (_.indexOf([
      'sub',
      'firstName',
      'lastName',
      'displayName',
      'email',
      'projectPermissions'], f) !== -1);
  });
};

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

exports.protectedGet = async function (args, res, next) {
  defaultLog.info('Getting users.');

  let query = {}, sort = {}, skip = null, limit = null, count = false;

  // Build match query if on userId route. Query by user sub so as to only get real users(not Contacts).
  if (args.swagger.params.userId && args.swagger.params.userId.value) {
    _.assignIn(query, { sub: args.swagger.params.userId.value });
  }

  // Set query type
  _.assignIn(query, { "_schemaName": "User" });

  try {
    const data = await Utils.runDataQuery('User',
      args.swagger.params.auth_payload.realm_access.roles,
      false, // User sub not needed here as results should only get returned to 'create-projects' users.
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
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

//  Create a new user
exports.protectedPost = async function (args, res, next) {
  var obj = args.swagger.params.user.value;
  defaultLog.info("Incoming new object:", obj);

  var User = mongoose.model('User');
  var user = new User({
    sub: obj.sub,
    firstName: obj.firstName,
    lastName: obj.lastName,
    displayName: obj.displayName,
    email: obj.email,
    read: ['staff', 'sysadmin'],
    write: ['staff', 'sysadmin'],
    delete: ['staff', 'sysadmin']
  });

  // Make the user's password salted and store that instead of the actual password.
  user = auth.setPassword(user);

  try {
    var u = await user.save();
    Utils.recordAction('Put', 'User', args.swagger.params.auth_payload.preferred_username, u._id);
    defaultLog.info('Saved new user object:', u);
    return Actions.sendResponse(res, 200, u);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

// Update an existing user
exports.protectedPut = async function (args, res, next) {
  var objId = args.swagger.params.userId.value;
  var obj = args.swagger.params.user.value;
  defaultLog.info("ObjectID:", args.swagger.params.userId.value);

  var User = require('mongoose').model('User');

  var user = {
    firstName: obj.firstName ? obj.firstName : '',
    middleName: obj.middleName ? obj.middleName : '',
    lastName: obj.lastName ? obj.lastName : '',
    displayName: obj.displayName ? obj.displayName : '',
    email: obj.email ? obj.email : '',
    org: obj.org ? obj.org : '',
    orgName: obj.orgName ? obj.orgName : '',
    title: obj.title ? obj.title : '',
    phoneNumber: obj.phoneNumber ? obj.phoneNumber : '',
    salutation: obj.salutation ? obj.salutation : '',
    department: obj.department ? obj.department : '',
    faxNumber: obj.faxNumber ? obj.faxNumber : '',
    cellPhoneNumber: obj.cellPhoneNumber ? obj.cellPhoneNumber : '',
    address1: obj.address1 ? obj.address1 : '',
    address2: obj.address2 ? obj.address2 : '',
    city: obj.city ? obj.city : '',
    province: obj.province ? obj.province : '',
    country: obj.country ? obj.country : '',
    postalCode: obj.postalCode ? obj.postalCode : '',
    notes: obj.notes ? obj.notes : ''
  }

  defaultLog.info("Incoming updated object:", user);

  try {
    var u = await User.findOneAndUpdate({ _id: objId }, obj, { upsert: false, new: true }).exec();
    Utils.recordAction('Put', 'User', args.swagger.params.auth_payload.preferred_username, objId);
    defaultLog.info('Organization updated:', u);
    return Actions.sendResponse(res, 200, u);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
}

const addProjectPermission = async (user, projId) => {
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
  const userId = mongoose.Types.ObjectId(args.swagger.params.userId.value);
  const projId = mongoose.Types.ObjectId(args.swagger.params.projId.value);
  defaultLog.info("Add project permission to user:", userId);

  const User = require('mongoose').model('User');

  // Find all users that have the sub field(real users as opposed to Contacts).
  User.find({_schemaName: 'User', sub: {$exists: true}}, (err, users) => {
    if (users) {
      users.forEach(user => {
        if (user._id.equals(userId)) {
          defaultLog.info("found user:", user);
          addProjectPermission(user, projId)
          .then((permissionAdded) => {
            Utils.recordAction('Add Permission', 'User', args.swagger.params.auth_payload.preferred_username, userId);
            // Return all users to be able to update list of users in Permissions tab.
            return Actions.sendResponse(res, 200, users);
          })
          .catch((err) => {
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
  const userId = mongoose.Types.ObjectId(args.swagger.params.userId.value);
  const projId = mongoose.Types.ObjectId(args.swagger.params.projId.value);
  defaultLog.info("Remove project permission from user:", userId);

  const User = require('mongoose').model('User');

  // Find all users that have the sub field(real users as opposed to Contacts).
  User.find({_schemaName: 'User', sub: {$exists: true}}, (err, users) => {
    if (users) {
      users.forEach(user => {
        if (user._id.equals(userId)) {
          defaultLog.info("found user:", user);
          removeProjectPermission(user, projId)
          .then((permissionAdded) => {
            Utils.recordAction('Remove Permission', 'User', args.swagger.params.auth_payload.preferred_username, userId);
            // Return all users to be able to update list of users in Permissions tab.
            return Actions.sendResponse(res, 200, users);
          })
          .catch((err) => {
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
