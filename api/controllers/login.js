var auth        = require("../helpers/auth");
var _           = require('lodash');
var defaultLog  = require('winston').loggers.get('default');

exports.loginOptions = function(args, res, next) {
  res.status(200).send();
};
exports.loginPost = function(args, res, next) {
  var User = require('mongoose').model('User');
  var username = args.body.username;
  var password = args.body.password;

  auth.checkAuthentication(username, password, function (err, user, message) {
    if (err || !user) {
      defaultLog.info("err:", err);
      defaultLog.info("user:", user);
      res.status(400).send(err);
    } else {
      defaultLog.info("Logged in:", user._id);
      // Remove sensitive data before login
      user.password = undefined;
      user.salt = undefined;

      var deviceId = "123";

      var scopes = user.roles;
      var token = auth.issueToken(user, deviceId, scopes);
      return res.status(200).send({
          accessToken: token
      });
    }
  });
};
