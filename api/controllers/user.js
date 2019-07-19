var auth = require("../helpers/auth");
var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

//  Create a new user
exports.protectedPost = async function (args, res, next) {
  var obj = args.swagger.params.user.value;
  defaultLog.info("Incoming new object:", obj);

  var User = mongoose.model('User');
  var user = new User({
    firstName: obj.firstName,
    middleName: obj.middleName,
    lastName: obj.lastName,
    displayName: obj.displayName,
    email: obj.email,
    org: obj.org,
    orgName: obj.orgName,
    title: obj.title,
    phoneNumber: obj.phoneNumber,
    salutation: obj.salutation,
    department: obj.department,
    faxNumber: obj.faxNumber,
    cellPhoneNumber: obj.cellPhoneNumber,
    address1: obj.address1,
    address2: obj.address2,
    city: obj.city,
    province: obj.province,
    country: obj.country,
    postalCode: obj.postalCode,
    notes: obj.notes,
    read: ['staff', 'sysadmin'],
    write: ['staff', 'sysadmin'],
    delete: ['staff', 'sysadmin']
  });

  // Make the user's password salted and store that instead of the actual password.
  user = auth.setPassword(user);

  try {
    var u = await user.save();
    Utils.recordAction('put', 'user', args.swagger.params.auth_payload.preferred_username, u._id);
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
    Utils.recordAction('put', 'user', args.swagger.params.auth_payload.preferred_username, objId);
    defaultLog.info('Organization updated:', u);
    return Actions.sendResponse(res, 200, u);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
}
