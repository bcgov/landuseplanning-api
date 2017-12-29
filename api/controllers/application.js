var auth        = require("../helpers/auth");
var _           = require('lodash');
var defaultLog  = require('winston').loggers.get('default');
var mongoose    = require('mongoose');

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

exports.publicGet = function (args, res, next) {
  // Build match query if on appId route
  var query = {};
  if (args.swagger.params.appId) {
    query = { "_id": mongoose.Types.ObjectId(args.swagger.params.appId.value)};
  }

  getApplications(['public'], query, args.swagger.params.fields.value)
  .then(function (data) {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(data));
  });
};
exports.protectedGet = function(args, res, next) {
  var self        = this;
  self.scopes     = args.swagger.params.auth_payload.scopes;

  var Application = mongoose.model('Application');
  var User        = mongoose.model('User');

  defaultLog.info("args.swagger.params:", args.swagger.params.auth_payload.scopes);

  // Build match query if on appId route
  var query = {};
  if (args.swagger.params.appId) {
    query = { "_id": mongoose.Types.ObjectId(args.swagger.params.appId.value)};
  }

  getApplications(args.swagger.params.auth_payload.scopes, query, args.swagger.params.fields.value)
  .then(function (data) {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(data));
  });
};

//  Create a new application
exports.protectedPost = function (args, res, next) {
  var obj = args.swagger.params.app.value;
  defaultLog.info("Incoming new object:", obj);

  var Application = mongoose.model('Application');
  var app = new Application(obj);
  // Define security tag defaults
  app.tags = [['sysadmin']];
  app.save()
  .then(function (a) {
    defaultLog.info("Saved new application object:", a);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(a));
  });
};

// Update an existing application
exports.protectedPut = function (args, res, next) {
  var objId = args.swagger.params.appId.value;
  defaultLog.info("ObjectID:", args.swagger.params.appId.value);

  var obj = args.swagger.params.app.value;
  // Strip security tags - these will not be updated on this route.
  delete obj.tags;
  defaultLog.info("Incoming updated object:", obj);

  var Application = require('mongoose').model('Application');
  Application.findOneAndUpdate({_id: objId}, obj, {upsert:false, new: true}, function (err, o) {
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

var getApplications = function (role, query, fields) {
  return new Promise(function (resolve, reject) {
    var Application = mongoose.model('Application');
    var projection = {};

    // Fields we always return
    var defaultFields = ['_id',
                        'code',
                        'tags'];
    _.each(defaultFields, function (f) {
        projection[f] = 1;
    });

    // Add requested fields - sanitize first by including only those that we can/want to return
    var sanitizedFields = _.remove(fields, function (f) {
      return (_.indexOf(['name',
                        'type',
                        'subtype',
                        'purpose',
                        'subpurpose',
                        'proponent',
                        'latitude',
                        'longitude',
                        'location',
                        'region',
                        'description',
                        'legalDescription',
                        'businessUnit',
                        'cl_files',
                        'commodityType',
                        'commodity',
                        'commodities'], f) !== -1);
    });
    _.each(sanitizedFields, function (f) {
      projection[f] = 1;
    });

    Application.aggregate([
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