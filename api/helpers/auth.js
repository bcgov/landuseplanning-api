"use strict";

var jwt             = require("jsonwebtoken");
var ISSUER          = "nrts-prc-api";
var JWT_SIGN_EXPIRY = process.env.JWT_SIGN_EXPIRY || "1440"; // 24 hours in minutes.
var SECRET          = process.env.SECRET || "defaultSecret";
var winston         = require('winston');
var defaultLog      = winston.loggers.get('default');

exports.verifyToken = function(req, authOrSecDef, token, callback) {
  defaultLog.info("verifying token");
  // scopes/roles defined for the current endpoint
  var currentScopes = req.swagger.operation["x-security-scopes"];
  function sendError() {
    return req.res.status(403).json({ message: "Error: Access Denied" });
  }

  // validate the 'Authorization' header. it should have the following format:
  //'Bearer tokenString'
  if (token && token.indexOf("Bearer ") == 0) {
    var tokenString = token.split(" ")[1];

    jwt.verify(tokenString, SECRET, function(
      verificationError,
      decodedToken
    ) {
      // check if the JWT was verified correctly
      if (
        verificationError == null &&
        Array.isArray(currentScopes) &&
        decodedToken &&
        decodedToken.scopes
      ) {
        defaultLog.info("JWT decoded:", decodedToken);
        // MBL: TODO - Check if JTI is revoked from other service?

        // check if the role is valid for this endpoint
        var roleMatch = currentScopes.some(r=> decodedToken.scopes.indexOf(r) >= 0)
        defaultLog.info("currentScopes", currentScopes);
        defaultLog.info("decodedToken.scopes", decodedToken.scopes);
        defaultLog.info("role match", roleMatch);

        // check if the issuer matches
        var issuerMatch = decodedToken.iss == ISSUER;
        defaultLog.info("decodedToken.iss", decodedToken.iss);
        defaultLog.info("ISSUER", ISSUER);
        defaultLog.info("issuerMatch", issuerMatch);

        if (roleMatch && issuerMatch) {
          // add the token to the request so that we can access it in the endpoint code if necessary
          req.swagger.params.auth_payload = decodedToken;
          defaultLog.info("JWT Verified.");
          return callback();
        } else {
          defaultLog.info("JWT Role/Issuer mismatch.");
          return callback(sendError());
        }
      } else {
        // return the error in the callback if the JWT was not verified
        defaultLog.info("JWT Verification Err:", verificationError);
        return callback(sendError());
      }
    });
  } else {
    defaultLog.info("Authorization Header Error.");
    return callback(sendError());
  }
};

exports.issueToken = function(user,
                              deviceId,
                              scopes) {
  defaultLog.info("user:",user);
  defaultLog.info("deviceId:",deviceId);
  defaultLog.info("scopes:",scopes);
  var crypto = require('crypto');
  var randomString = crypto.randomBytes(32).toString('hex');
  var jti = crypto.createHash('sha256').update(user.username + deviceId + randomString).digest('hex');
  defaultLog.info("JTI:", jti);

  var payload = {
    username: user.username,
    userID: user._id,
    deviceId: deviceId,
    jti: jti,
    iss: ISSUER,
    scopes: scopes
  };

  var token = jwt.sign(payload,
                        SECRET,
                        {expiresIn: JWT_SIGN_EXPIRY + 'm'});
  defaultLog.info("ISSUING NEW TOKEN:expiresIn:", JWT_SIGN_EXPIRY + 'm');

  return token;
};

var hashPassword = function (user, password) {
  if (user.salt && password) {
    var crypto = require('crypto');
    return crypto.pbkdf2Sync(password, new Buffer(user.salt, 'base64'), 10000, 64, 'sha1').toString('base64');
  } else {
    return password;
  }
};

exports.setPassword = function (user) {
  var bcrypt = require("bcrypt-nodejs");
  user.salt = bcrypt.genSaltSync(16);
  user.password = hashPassword(user, user.password);
  return user;
}
/**
 * Create instance method for authenticating user
 */
var authenticate = function (user, password) {
  defaultLog.info("HASH:", hashPassword(user, password));
  defaultLog.info("user.password:", user.password);
  return user.password === hashPassword(user, password);
};

exports.checkAuthentication = function (username, password, cb) {
  defaultLog.info("authStrategy loading");
  var User = require('mongoose').model('User');

  // Look this user up in the db and hash their password to see if it's correct.
  User.findOne({
    username: username.toLowerCase()
  }, function (err, user) {
    if (err) {
      defaultLog.info("ERR:", err);
      return cb(err);
    }
    defaultLog.info("continuing");
    if (!user || !authenticate(user, password)) {
      defaultLog.info("bad username or password!");
      return cb(null, false, {
        message: 'Invalid username or password'
      });
    }
    defaultLog.info("YAY");
    return cb(null, user);
  });
};