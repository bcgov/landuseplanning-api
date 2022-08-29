'use strict';

var jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Old keycloak endpoints
// var ISSUER = process.env.SSO_ISSUER || "https://dev.loginproxy.gov.bc.ca/auth/realms/standard";
// var JWKSURI = process.env.SSO_JWKSURI || "https://dev.loginproxy.gov.bc.ca/auth/realms/standard/protocol/openid-connect/certs";
var ISSUER = process.env.SSO_ISSUER || "https://oidc.gov.bc.ca/auth/realms/aaoozhcp";
var JWKSURI = process.env.SSO_JWKSURI || "https://oidc.gov.bc.ca/auth/realms/aaoozhcp/protocol/openid-connect/certs";
var JWT_SIGN_EXPIRY = process.env.JWT_SIGN_EXPIRY || "1440"; // 24 hours in minutes.
var SECRET          = process.env.SECRET || "defaultSecret";
var KEYCLOAK_ENABLED = process.env.KEYCLOAK_ENABLED || "true";
var winston         = require('winston');
var defaultLog      = winston.loggers.get('devLog');

exports.verifyToken = function(req, authOrSecDef, token, callback) {
  defaultLog.info('verifying authentication token', token);
  // scopes/roles defined for the current endpoint
  var currentScopes = req.swagger.operation['x-security-scopes'];
  function sendError() {
    return req.res.status(403).json({ message: 'Error: Access Denied' });
  }

  // validate the 'Authorization' header. it should have the following format:
  //'Bearer tokenString'
  if (token && token.indexOf('Bearer ') == 0) {
    var tokenString = token.split(' ')[1];

    // If Keycloak is enabled, get the JWKSURI and process accordingly.  Else
    // use local environment JWT configuration.
    if (KEYCLOAK_ENABLED === 'true') {
      defaultLog.info('Keycloak Enabled, remote JWT verification.');
      const client = jwksClient({
        strictSsl: true, // Default value
        jwksUri: JWKSURI
      });

      const kid = jwt.decode(tokenString, { complete: true }).header.kid;

      client.getSigningKey(kid, (err, key) => {
        if (err) {
          defaultLog.error('Signing Key Error:', err);
          callback(sendError());
        } else {
          const signingKey = key.publicKey || key.rsaPublicKey;
          console.log('got signing key', signingKey)
          _verifySecret(currentScopes, tokenString, signingKey, req, callback, sendError);
        }
      });
    } else {
      defaultLog.info('proceeding with local JWT verification:', tokenString);
      _verifySecret(currentScopes, tokenString, SECRET, req, callback, sendError);
    }
  } else {
    defaultLog.error("Token didn't have a bearer.");
    req.swagger.params.auth_payload = {
      realm_access: {
        roles: ['public']
      },
      preferred_username: 'public'
    };
    return callback(null);
  }
};

function _verifySecret(currentScopes, tokenString, secret, req, callback, sendError) {
  var decoded = jwt.decode(tokenString, {complete: true});

  console.log('the decoded token', decoded)
  jwt.verify(tokenString, secret, function (
    verificationError,
    decodedToken
  ) {
    // check if the JWT was verified correctly
    if (verificationError == null &&
      decodedToken &&
      decodedToken.client_roles
    ) {
      defaultLog.info("JWT decoded:", decodedToken);
      defaultLog.info("decodedToken.client_roles", decodedToken.client_roles);

      // check if the dissuer matches
      var issuerMatch = decodedToken.iss == ISSUER;
      defaultLog.info("decodedToken.iss", decodedToken.iss);
      defaultLog.info("ISSUER", ISSUER);
      defaultLog.info("issuerMatch", issuerMatch);

      // if (roleMatch && issuerMatch) {
      if (issuerMatch) {
        // add the token to the request so that we can access it in the endpoint code if necessary
        req.swagger.params.auth_payload = decodedToken;
        defaultLog.info("JWT Verified.");
        return callback(null);
      } else {
        defaultLog.error("JWT Role/Issuer mismatch.");
        return callback(sendError());
      }
    } else {
      // return the error in the callback if the JWT was not verified
      defaultLog.error("JWT Verification Err:", verificationError);
      defaultLog.info('decoded', decodedToken)
      defaultLog.info('token string', tokenString)
      return callback(sendError());
    }
  });
}

exports.issueToken = function (user,
  deviceId,
  scopes) {
  defaultLog.info("user:", user);
  defaultLog.info("deviceId:", deviceId);
  defaultLog.info("scopes:", scopes);
  var crypto = require('crypto');
  var randomString = crypto.randomBytes(32).toString('hex');
  var jti = crypto.createHash('sha256').update(user.username + deviceId + randomString).digest('hex');
  defaultLog.info("JTI:", jti);

  var payload = {
    name: user.username,
    preferred_username: user.username,
    userID: user._id,
    deviceId: deviceId,
    jti: jti,
    iss: ISSUER,
    realm_access: {
      roles: scopes
    }
  };

  var token = jwt.sign(payload,
    SECRET,
    { expiresIn: JWT_SIGN_EXPIRY + 'm' });
  defaultLog.info("ISSUING NEW TOKEN:expiresIn:", JWT_SIGN_EXPIRY + 'm');

  return token;
};

var hashPassword = function(user, password) {
  if (user.salt && password) {
    var crypto = require('crypto');
    return crypto.pbkdf2Sync(password, new Buffer(user.salt, 'base64'), 10000, 64, 'sha1').toString('base64');
  } else {
    return password;
  }
};

exports.setPassword = function(user) {
  var bcrypt = require('bcrypt-nodejs');
  user.salt = bcrypt.genSaltSync(16);
  user.password = hashPassword(user, user.password);
  return user;
};
/**
 * Create instance method for authenticating user
 */
var authenticate = function(user, password) {
  defaultLog.info('HASH:', hashPassword(user, password));
  defaultLog.info('user.password:', user.password);
  return user.password === hashPassword(user, password);
};

exports.checkAuthentication = function(username, password, cb) {
  defaultLog.info('authStrategy loading');
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