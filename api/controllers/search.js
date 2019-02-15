var auth         = require("../helpers/auth");
var _            = require('lodash');
var defaultLog   = require('winston').loggers.get('default');
var mongoose     = require('mongoose');
var Actions      = require('../helpers/actions');
var Utils        = require('../helpers/utils');
var request      = require('request');
var _accessToken = null;

exports.publicGet = function (args, res, next) {
  var keywords = args.swagger.params.keywords.value;
  defaultLog.info("Searching keywords:", keywords);

  var Project = mongoose.model('Project');
  Project.find({ $text: { $search: keywords}}, function (err, data) {
    if (err) {
      console.log("err:", err);
      return Actions.sendResponse(res, 400, err);
    } else {
      console.log(data);
      return Actions.sendResponse(res, 200, data);
    }
  })

};

exports.protectedOptions = function (args, res, next) {
  res.status(200).send();
};