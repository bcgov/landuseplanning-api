var auth        = require("../helpers/auth");
var _           = require('lodash');
var defaultLog  = require('winston').loggers.get('default');
var mongoose    = require('mongoose');
var Actions     = require('../helpers/actions');
var Utils       = require('../helpers/utils');

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

exports.publicGet = function (args, res, next) {
  // Build match query if on orgId route
  var query = {};
  if (args.swagger.params.orgId) {
    query = Utils.buildQuery("_id", args.swagger.params.orgId.value, query);
  }

  getOrganizations(['public'], query, args.swagger.params.fields.value)
  .then(function (data) {
    return Actions.sendResponse(res, 200, data);
  });
};
exports.protectedGet = function(args, res, next) {
  var self        = this;
  self.scopes     = args.swagger.operation["x-security-scopes"];

  var Organization = mongoose.model('Organization');

  defaultLog.info("args.swagger.params:", args.swagger.operation["x-security-scopes"]);

  // Build match query if on orgId route
  var query = {};
  if (args.swagger.params.orgId) {
    query = Utils.buildQuery("_id", args.swagger.params.orgId.value, query);
  }

  getOrganizations(args.swagger.operation["x-security-scopes"], query, args.swagger.params.fields.value)
  .then(function (data) {
    return Actions.sendResponse(res, 200, data);
  });
};

//  Create a new organization
exports.protectedPost = function (args, res, next) {
  var obj = args.swagger.params.org.value;
  defaultLog.info("Incoming new object:", obj);

  var Organization = mongoose.model('Organization');
  var app = new Organization(obj);
  // Define security tag defaults
  app.tags = [['sysadmin']];
  // Update who did this?
  app._addedBy = args.swagger.params.auth_payload.preferred_username;
  app.save()
  .then(function (a) {
    // defaultLog.info("Saved new organization object:", a);
    return Actions.sendResponse(res, 200, a);
  });
};

// Update an existing organization
exports.protectedPut = function (args, res, next) {
  var objId = args.swagger.params.orgId.value;
  defaultLog.info("ObjectID:", args.swagger.params.orgId.value);

  var obj = args.swagger.params.orgId.value;
  // Strip security tags - these will not be updated on this route.
  delete obj.tags;
  defaultLog.info("Incoming updated object:", obj);

  var Organization = require('mongoose').model('Organization');
  Organization.findOneAndUpdate({_id: objId}, obj, {upsert:false, new: true}, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);
      return Actions.sendResponse(res, 200, o);
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
}
// Publish/Unpublish the organization
exports.protectedPublish = function (args, res, next) {
  var objId = args.swagger.params.orgId.value;
  defaultLog.info("Publish Organization:", objId);

  var Organization = require('mongoose').model('Organization');
  Organization.findOne({_id: objId}, function (err, o) {
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
  Organization.findOne({_id: objId}, function (err, o) {
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
var getOrganizations = function (role, query, fields) {
  return new Promise(function (resolve, reject) {
    var Organization = mongoose.model('Organization');
    var projection = {};

    // Fields we always return
    var defaultFields = ['_id',
                        'code',
                        'name',
                        'tags'];
    _.each(defaultFields, function (f) {
        projection[f] = 1;
    });

    // Add requested fields - sanitize first by including only those that we can/want to return
    var sanitizedFields = _.remove(fields, function (f) {
      return (_.indexOf(['name',
                        'code'], f) !== -1);
    });
    _.each(sanitizedFields, function (f) {
      projection[f] = 1;
    });

    Organization.aggregate([
      {
        "$match": query
      },
      {
        "$project": projection
      },
      {
        $redact: {
         $cond: {
            if: {
              $anyElementTrue: {
                    $map: {
                      input: "$tags" ,
                      as: "fieldTag",
                      in: { $setIsSubset: [ "$$fieldTag", role ] }
                    }
                  }
                },
              then: "$$DESCEND",
              else: "$$PRUNE"
            }
          }
        }
    ]).exec()
    .then(function (data) {
      defaultLog.info("data:", data);
      resolve(data);
    });
  });
};