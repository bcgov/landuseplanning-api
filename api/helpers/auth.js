'use strict';

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const ISSUER =
  process.env.SSO_ISSUER ||
  'https://dev.loginproxy.gov.bc.ca/auth/realms/standard';
const JWKSURI =
  process.env.SSO_JWKSURI ||
  'https://dev.loginproxy.gov.bc.ca/auth/realms/standard/protocol/openid-connect/certs';
const SECRET = process.env.SECRET || 'defaultSecret';
const KEYCLOAK_ENABLED = process.env.KEYCLOAK_ENABLED || 'true';
const winston = require('winston');
const defaultLog = winston.loggers.get('defaultLog');

exports.verifyToken = (req, authOrSecDef, token, callback) => {
  defaultLog.info('verifying authentication token');
  // scopes/roles defined for the current endpoint
  const currentScopes = req.swagger.operation['x-security-scopes'];
  const sendError = () => {
    return req.res.status(403).json({ message: 'Error: Access Denied' });
  };

  // validate the 'Authorization' header. it should have the following format:
  // 'Bearer tokenString'
  if (token && token.indexOf('Bearer ') === 0) {
    const tokenString = token.split(' ')[1];

    // If Keycloak is enabled, get the JWKSURI and process accordingly. Else
    // use local environment JWT configuration.
    if (KEYCLOAK_ENABLED === 'true') {
      defaultLog.info('Keycloak Enabled, remote JWT verification.');

      const client = jwksClient({
        strictSsl: true, // Default value
        jwksUri: JWKSURI,
      });

      const decodedHeader = jwt.decode(tokenString, { complete: true });
      if (
        !decodedHeader ||
        !decodedHeader.header ||
        !decodedHeader.header.kid
      ) {
        defaultLog.error('JWT header missing or invalid (no kid).');
        return callback(sendError());
      }
      const kid = decodedHeader.header.kid;

      client.getSigningKey(kid, (err, key) => {
        if (err) {
          defaultLog.error('Signing Key Error:', err);
          callback(sendError());
        } else {
          const signingKey = key.publicKey || key.rsaPublicKey;
          _verifySecret(
            currentScopes,
            tokenString,
            signingKey,
            req,
            callback,
            sendError
          );
        }
      });
    } else {
      defaultLog.info('proceeding with local JWT verification');
      _verifySecret(
        currentScopes,
        tokenString,
        SECRET,
        req,
        callback,
        sendError
      );
    }
  } else {
    defaultLog.error("Token didn't have a bearer.");
    req.swagger.params.auth_payload = {
      realm_access: {
        roles: ['public'],
      },
      preferred_username: 'public',
    };
    return callback(null);
  }
};

const _verifySecret = (
  currentScopes,
  tokenString,
  secret,
  req,
  callback,
  sendError
) => {
  
  const verifyOptions = { issuer: ISSUER };

  jwt.verify(
    tokenString,
    secret,
    verifyOptions,
    (verificationError, decodedToken) => {
      // check if the JWT was verified correctly
      if (
        verificationError == null &&
        decodedToken &&
        decodedToken.client_roles
      ) {
        defaultLog.info('JWT decoded (roles present).');

        // check if the issuer matches
        const issuerMatch = decodedToken.iss == ISSUER;
        defaultLog.info('decodedToken.iss', decodedToken.iss);
        defaultLog.info('ISSUER', ISSUER);
        defaultLog.info('issuerMatch', issuerMatch);

        // if (roleMatch && issuerMatch) {
        if (issuerMatch) {
          // add the token to the request so that we can access it in the endpoint code if necessary
          req.swagger.params.auth_payload = decodedToken;
          defaultLog.info('JWT Verified.');
          return callback(null);
        } else {
          defaultLog.error('JWT Role/Issuer mismatch.');
          return callback(sendError());
        }
      } else {
        // return the error in the callback if the JWT was not verified
        defaultLog.error('JWT Verification Err:', verificationError);
        defaultLog.info('decoded', decodedToken);
        return callback(sendError());
      }
    }
  );
};
