var auth        = require("../helpers/auth");
var _           = require('lodash');
var defaultLog  = require('winston').loggers.get('default');

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

exports.publicGet = function (args, res, next) {
  getApplications(['public'])
  .then(function (data) {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(data));
  });
};
exports.protectedGet = function(args, res, next) {
  var self        = this;
  self.scopes     = args.swagger.params.auth_payload.scopes;

  var Application = require('mongoose').model('Application');
  var User        = require('mongoose').model('User');

  defaultLog.info("args.swagger.params:", args.swagger.params.auth_payload.scopes);

  getApplications(args.swagger.params.auth_payload.scopes)
  .then(function (data) {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(data));
  });
};

//  Create a new application
exports.protectedPost = function (args, res, next) {
  var obj = args.swagger.params.app.value;
  defaultLog.info("Incoming new object:", obj);

  var Application = require('mongoose').model('Application');
  var app = new Application(obj);
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

var getApplications = function (role) {
  return new Promise(function (resolve, reject) {
    var Application = require('mongoose').model('Application');
    var projection = {};
    var fields = ['_id',
                  'code',
                  'name',
                  'type',
                  'purpose',
                  'subpurpose',
                  'proponent',
                  'commodityType',
                  'commodity',
                  'commodities',
                  'tags'];
    _.each(fields, function (f) {
        projection[f] = 1;
    });
    Application.aggregate([
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