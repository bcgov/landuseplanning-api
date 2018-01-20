var auth        = require("../helpers/auth");
var _           = require('lodash');
var defaultLog  = require('winston').loggers.get('default');
var mongoose    = require('mongoose');
var Actions     = require('../helpers/actions');
var Utils       = require('../helpers/utils');

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

exports.protectedGet = function(args, res, next) {
  var self        = this;
  self.scopes     = args.swagger.params.auth_payload.scopes;

  var User = mongoose.model('User');

  defaultLog.info("args.swagger.params:", args.swagger.params.auth_payload.scopes);

  // Build match query if on userId route
  var query = {};
  if (args.swagger.params.userId) {
    query = Utils.buildQuery("_id", args.swagger.params.userId.value, query);
  }

  getUsers(args.swagger.params.auth_payload.scopes, query, args.swagger.params.fields.value)
  .then(function (data) {
    return Actions.sendResponse(res, 200, data);
  });
};

//  Create a new organization
exports.protectedPost = function (args, res, next) {
  var obj = args.swagger.params.user.value;
  defaultLog.info("Incoming new object:", obj);

  var User = mongoose.model('User');
  var user = new User(obj);
  // Define security tag defaults - users not public by default.
  user.tags = [['sysadmin']];
  user.save()
  .then(function (a) {
    defaultLog.info("Saved new organization object:", a);
    return Actions.sendResponse(res, 200, data);
  });
};

// Update an existing organization
exports.protectedPut = function (args, res, next) {
  var objId = args.swagger.params.userId.value;
  defaultLog.info("ObjectID:", args.swagger.params.userId.value);

  var obj = args.swagger.params.app.value;
  // NB: Don't strip security tags on protectedPut.  Only sysadmins
  // Can call this route.
  // delete obj.tags;
  defaultLog.info("Incoming updated object:", obj);

  var User = require('mongoose').model('User');
  User.findOneAndUpdate({_id: objId}, obj, {upsert:false, new: true}, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);
      return Actions.sendResponse(res, 200, o);
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
}

var getUsers = function (role, query, fields) {
  return new Promise(function (resolve, reject) {
    var User = mongoose.model('User');
    var projection = {};

    // Fields we always return
    var defaultFields = ['_id',
                        'displayName',
                        'roles',
                        'tags'];
    _.each(defaultFields, function (f) {
        projection[f] = 1;
    });

    // Add requested fields - sanitize first by including only those that we can/want to return
    var sanitizedFields = _.remove(fields, function (f) {
      return (_.indexOf(['displayName', 'firstName', 'lastName', 'username', 'roles'], f) !== -1);
    });
    _.each(sanitizedFields, function (f) {
      projection[f] = 1;
    });

    // No need to redact because 'sysadmin'
    User.aggregate([
      {
        "$match": query
      },
      {
        "$project": projection
      }
    ]).exec()
    .then(function (data) {
      defaultLog.info("data:", data);
      resolve(data);
    });
  });
};