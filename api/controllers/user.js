const _ = require('lodash');
const defaultLog = require('winston').loggers.get('defaultLog');
const mongoose = require('mongoose');
const Actions = require('../helpers/actions');
const Utils = require('../helpers/utils');

const getSanitizedFields = (fields) => {
  return _.remove(fields, (f) => {
    return (
      _.indexOf(
        [
          'sub',
          'idirUserGuid',
          'firstName',
          'lastName',
          'displayName',
          'email',
          'projectPermissions',
        ],
        f
      ) !== -1
    );
  });
};

exports.protectedOptions = (args, res) => {
  defaultLog.info('USER PROTECTED OPTIONS');
  res.status(200).send();
};

exports.protectedGet = async (args, res) => {
  defaultLog.info('USER PROTECTED GET', args.swagger.params);

  let query = {},
    sort = {},
    skip = null,
    limit = null,
    count = false;

  // Build match query if on userId route. Query by user idirUserGuid so as to only get real users (not Contacts).
  if (args.swagger.params.userId && args.swagger.params.userId.value) {
    _.assignIn(query, { idirUserGuid: args.swagger.params.userId.value });
  }

  // Set query type
  _.assignIn(query, { _schemaName: 'User' });

  try {
    const data = await Utils.runDataQuery(
      'User',
      args.swagger.params.auth_payload.client_roles,
      false, // User GUID not needed here as results should only get returned to 'create-projects' users.
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null, // sort warmup
      sort, // sort
      skip, // skip
      limit, // limit
      count // count
    );

    Utils.recordAction(
      'Get',
      'User',
      args.swagger.params.auth_payload.preferred_username,
      data[0] && data[0]._id ? data[0]._id.toString() : null
    );
    defaultLog.info('Got user(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedGetByEmail = async (args, res) => {
  defaultLog.info('USER PROTECTED GET BY EMAIL', args.swagger.params.userEmail);

  let query = {},
    sort = {},
    skip = null,
    limit = null,
    count = false;

  // Build match query if on userId route. Query by user guid so as to only get real users (not Contacts).
  if (args.swagger.params.userEmail && args.swagger.params.userEmail.value) {
    _.assignIn(query, { email: args.swagger.params.userEmail.value });
  }

  // Set query type
  _.assignIn(query, { _schemaName: 'User' });

  try {
    const data = await Utils.runDataQuery(
      'User',
      args.swagger.params.auth_payload.client_roles,
      false, // User GUID not needed here as results should only get returned to 'create-projects' users.
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null, // sort warmup
      sort, // sort
      skip, // skip
      limit, // limit
      count // count
    );

    Utils.recordAction(
      'Get',
      'User',
      args.swagger.params.auth_payload.preferred_username,
      data[0] && data[0]._id ? data[0]._id.toString() : null
    );
    defaultLog.info('Got user(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

//  Create a new user
exports.protectedPost = async (args, res) => {
  defaultLog.info('USER PROTECTED POST');
  const obj = args.swagger.params.user.value;
  defaultLog.info('Incoming new object:', obj);

  const User = mongoose.model('User');
  const user = new User({
    firstName: obj.firstName,
    lastName: obj.lastName,
    displayName: obj.displayName,
    email: obj.email,
    idirUserGuid: obj.idirUserGuid,
    read: ['staff', 'sysadmin'],
    write: ['staff', 'sysadmin'],
    delete: ['staff', 'sysadmin'],
  });

  try {
    const u = await user.save();
    Utils.recordAction(
      'Post',
      'User',
      args.swagger.params.auth_payload.preferred_username,
      u._id
    );
    defaultLog.info('Saved new user:', u._id);
    return Actions.sendResponse(res, 200, u._id);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

// Update an existing user
exports.protectedPut = async (args, res) => {
  defaultLog.info('USER PROTECTED PUT');
  const objId = args.swagger.params.userId.value;
  const obj = args.swagger.params.user.value;
  defaultLog.info('Put user:', args.swagger.params.userId.value);

  const User = mongoose.model('User');

  try {
    const u = await User.findOneAndUpdate({ _id: objId }, obj, {
      upsert: false,
      new: true,
    }).exec();

    Utils.recordAction(
      'Put',
      'User',
      args.swagger.params.auth_payload.preferred_username,
      objId
    );
    defaultLog.info('User updated:', u && u._id ? u._id : objId);
    return Actions.sendResponse(res, 200, u);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

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
  });
};

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
};

const removeUser = async (user) => {
  const UserModel = mongoose.model('User');
  const ProjectModel = mongoose.model('Project');
  if (user._id && user.displayName) {
    defaultLog.info(`Attempting to remove user ${user.displayName}`);
    try {
      const result = await UserModel.findOneAndDelete({ _id: user._id });
      // Also remove projectLead and projectDirector values from any applicable projects
      await ProjectModel.updateMany(
        { projectLead: user._id },
        { $set: { projectLead: null } }
      );
      await ProjectModel.updateMany(
        { projectDirector: user._id },
        { $set: { projectDirector: null } }
      );
      defaultLog.info('User deleted: ', user._id);
      return result;
    } catch (e) {
      defaultLog.error('Error while removing user:', e);
      throw e;
    }
  } else {
    throw new Error('The request to delete a user is malformed.');
  }
};

exports.protectedAddPermission = async (args, res) => {
  defaultLog.info('USER PROTECTED ADD PERMISSION');
  const userId = mongoose.Types.ObjectId(args.swagger.params.userId.value);
  const projId = mongoose.Types.ObjectId(args.swagger.params.projId.value);
  const User = mongoose.model('User');

  try {
    // Find all users that have the idirUserGuid field (real users as opposed to Contacts).
    const users = await User.find({ _schemaName: 'User', idirUserGuid: { $exists: true } });

    if (!users || users.length === 0) {
      defaultLog.info("Couldn't find user!");
      return Actions.sendResponse(res, 404, {});
    }

    // Locate the target user among the returned set.
    const targetUser = users.find((user) => user._id.equals(userId));
    if (!targetUser) {
      defaultLog.info("Couldn't find user!");
      return Actions.sendResponse(res, 404, {});
    }

    // Add permission (uses existing helper which returns a Promise)
    await addProjectPermission(targetUser, projId);

    Utils.recordAction(
      'Add Permission',
      'User',
      args.swagger.params.auth_payload.preferred_username,
      userId
    );
    defaultLog.info('Permission added to user', userId);

    // Return all users to be able to update list of users in Permissions tab.
    return Actions.sendResponse(res, 200, users);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 500, e);
  }
};


exports.protectedRemovePermission = async (args, res) => {
  defaultLog.info('USER PROTECTED REMOVE PERMISSION');
  const params = args.swagger.params;
  try {
    // Validate and build ObjectIds
    const userIdParam = params && params.userId;
    const projIdParam = params && params.projId;
    const authPayload = params && params.auth_payload;

    if (!userIdParam || !userIdParam.value || !projIdParam || !projIdParam.value) {
      return Actions.sendResponse(res, 400, { message: 'Missing userId or projId' });
    }

    const userId = new mongoose.Types.ObjectId(userIdParam.value);
    const projId = new mongoose.Types.ObjectId(projIdParam.value);

    const User = mongoose.model('User');
    const user = await User.findOne({
      _schemaName: 'User',
      idirUserGuid: { $exists: true },
      _id: userId
    }).exec();

    if (!user) {
      defaultLog.info("Couldn't find user!");
      return Actions.sendResponse(res, 404, { message: 'User not found' });
    }
    await removeProjectPermission(user, projId);
    const username =
      authPayload && authPayload.preferred_username
        ? authPayload.preferred_username
        : undefined;

    Utils.recordAction('Remove Permission', 'User', username, userId);
    defaultLog.info('Permission removed from user', userId);

    // Return full list for the Permissions tab
    const users = await User.find({
      _schemaName: 'User',
      idirUserGuid: { $exists: true }
    }).exec();

    return Actions.sendResponse(res, 200, users);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 500, e);
  }
};

exports.protectedRemove = async (args, res) => {
  defaultLog.info('USER PROTECTED REMOVE');
  const userId = mongoose.Types.ObjectId(args.swagger.params.userId.value);
  const User = mongoose.model('User');
  try {
    const users = await User.find({
      _schemaName: 'User',
      idirUserGuid: { $exists: true },
    });
    const targetUser = users.find((user) => user._id.equals(userId));
    if (!targetUser) {
      defaultLog.info("Couldn't find user!");
      return Actions.sendResponse(res, 404, {});
    }
    await removeUser(targetUser);
    Utils.recordAction(
      'Remove User',
      'User',
      args.swagger.params.auth_payload.preferred_username,
      userId
    );
    defaultLog.info('User removed', userId);
    const updatedUsers = await User.find({
      _schemaName: 'User',
      idirUserGuid: { $exists: true },
    });
    return Actions.sendResponse(res, 200, updatedUsers);
  } catch (err) {
    defaultLog.error('Error in protectedRemove:', err);
    return Actions.sendResponse(res, 500, err.message || err);
  }
};
