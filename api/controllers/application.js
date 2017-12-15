var auth        = require("../helpers/auth");
var _           = require('lodash');
var defaultLog  = require('winston').loggers.get('default');

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}
exports.protectedGet = function(args, res, next) {
  var self        = this;
  self.scopes     = args.swagger.params.auth_payload.scopes;

  var Application = require('mongoose').model('Application');
  var User        = require('mongoose').model('User');

  defaultLog.info("args.swagger.params:", args.swagger.params.auth_payload.scopes);

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
                                         in: { $setIsSubset: [ "$$fieldTag", self.scopes ] }
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
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(data));
  });
};
