var auth        = require("../helpers/auth");
var _           = require('lodash');
var defaultLog  = require('winston').loggers.get('default');
var mongoose    = require('mongoose');

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

exports.publicGet = function (args, res, next) {
  // Build match query if on orgId route
  var query = {};
  if (args.swagger.params.orgId) {
    query = { "_id": mongoose.Types.ObjectId(args.swagger.params.orgId.value)};
  }

  getOrganizations(['public'], query, args.swagger.params.fields.value)
  .then(function (data) {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(data));
  });
};
exports.protectedGet = function(args, res, next) {
  var self        = this;
  self.scopes     = args.swagger.params.auth_payload.scopes;

  var Organization = mongoose.model('Organization');
  var User        = mongoose.model('User');

  defaultLog.info("args.swagger.params:", args.swagger.params.auth_payload.scopes);

  // Build match query if on orgId route
  var query = {};
  if (args.swagger.params.orgId) {
    query = { "_id": mongoose.Types.ObjectId(args.swagger.params.orgId.value)};
  }

  getOrganizations(args.swagger.params.auth_payload.scopes, query, args.swagger.params.fields.value)
  .then(function (data) {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(data));
  });
};

//  Create a new organization
exports.protectedPost = function (args, res, next) {
  var obj = args.swagger.params.app.value;
  defaultLog.info("Incoming new object:", obj);

  var Organization = mongoose.model('Organization');
  var app = new Organization(obj);
  // Define security tag defaults
  app.tags = [['sysadmin']];
  app.save()
  .then(function (a) {
    defaultLog.info("Saved new organization object:", a);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(a));
  });
};

// Update an existing organization
exports.protectedPut = function (args, res, next) {
  var objId = args.swagger.params.orgId.value;
  defaultLog.info("ObjectID:", args.swagger.params.orgId.value);

  var obj = args.swagger.params.app.value;
  // Strip security tags - these will not be updated on this route.
  delete obj.tags;
  defaultLog.info("Incoming updated object:", obj);

  var Organization = require('mongoose').model('Organization');
  Organization.findOneAndUpdate({_id: objId}, obj, {upsert:false, new: true}, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(o));
    } else {
      defaultLog.info("Couldn't find that object!");
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({}));
    }
  });
}

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