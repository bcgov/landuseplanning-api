var auth = require("../helpers/auth");
var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

//  Create a new organization
exports.protectedPost = async function (args, res, next) {
  var obj = args.swagger.params.org.value;
  defaultLog.info("Incoming new object:", obj);

  var Organization = mongoose.model('Organization');
  var organization = new Organization({
    _schemaName: 'Organization',
    addedBy: args.swagger.params.auth_payload.preferred_username,
    description: obj.description,
    name: obj.name,
    updatedBy: args.swagger.params.auth_payload.preferred_username,
    dateAdded: new Date(),
    dateUpdated: new Date(),
    country: obj.country,
    postal: obj.postal,
    province: obj.province,
    city: obj.city,
    address1: obj.address1,
    address2: obj.address2,
    companyType: obj.companyType,
    parentCompany: mongoose.Types.ObjectId.isValid(obj.parentCompany) ? mongoose.Types.ObjectId(obj.parentCompany) : null,
    companyLegal: obj.companyLegal,
    company: obj.company,
    read: ['staff', 'sysadmin'],
    write: ['staff', 'sysadmin'],
    delete: ['staff', 'sysadmin']
  });

  try {
    var org = await organization.save();
    Utils.recordAction('put', 'organization', args.swagger.params.auth_payload.preferred_username, org._id);
    defaultLog.info('Saved new organization object:', org);
    return Actions.sendResponse(res, 200, org);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

// Update an existing organization
exports.protectedPut = async function (args, res, next) {
  var objId = args.swagger.params.orgId.value;
  var obj = args.swagger.params.org.value;
  defaultLog.info("ObjectID:", args.swagger.params.orgId.value);

  var Organization = mongoose.model('Organization');

  var organization = {
    description: obj.description ? obj.description : '',
    name: obj.name ? obj.name : '',
    updatedBy: args.swagger.params.auth_payload.preferred_username,
    dateAdded: new Date(),
    dateUpdated: new Date(),
    country: obj.country ? obj.country : '',
    postal: obj.postal ? obj.postal : '',
    province: obj.province ? obj.province : '',
    city: obj.city ? obj.city : '',
    address1: obj.address1 ? obj.address1 : '',
    address2: obj.address2 ? obj.address2 : '',
    companyType: obj.companyType ? obj.companyType : '',
    parentCompany: mongoose.Types.ObjectId.isValid(obj.parentCompany) ? mongoose.Types.ObjectId(obj.parentCompany) : null,
    companyLegal: obj.companyLegal ? obj.companyLegal : '',
    company: obj.company ? obj.company : ''
  };

  defaultLog.info("Incoming updated object:", organization);

  try {
    var org = await Organization.findOneAndUpdate({ _id: objId }, obj, { upsert: false, new: true }).exec();
    Utils.recordAction('put', 'organization', args.swagger.params.auth_payload.preferred_username, objId);
    defaultLog.info('Organization updated:', org);
    return Actions.sendResponse(res, 200, org);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
}

// Publish/Unpublish the organization
exports.protectedPublish = function (args, res, next) {
  var objId = args.swagger.params.orgId.value;
  defaultLog.info("Publish Organization:", objId);

  var Organization = require('mongoose').model('Organization');
  Organization.findOne({ _id: objId }, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);

      // Add public to the tag of this obj.
      Actions.publish(o)
        .then(function (published) {
          // Published successfully
          return Actions.sendResponse(res, 200, published);
        }, function (err) {
          // Error
          return Actions.sendResponse(res, err.code, err);
        });
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
};
exports.protectedUnPublish = function (args, res, next) {
  var objId = args.swagger.params.orgId.value;
  defaultLog.info("UnPublish Organization:", objId);

  var Organization = require('mongoose').model('Organization');
  Organization.findOne({ _id: objId }, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);

      // Remove public to the tag of this obj.
      Actions.unPublish(o)
        .then(function (unpublished) {
          // UnPublished successfully
          return Actions.sendResponse(res, 200, unpublished);
        }, function (err) {
          // Error
          return Actions.sendResponse(res, err.code, err);
        });
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
};
