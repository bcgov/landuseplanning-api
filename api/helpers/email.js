'use strict';

const axios = require('axios');
const qs = require('qs');
const winston = require('winston');
const defaultLog = winston.loggers.get('defaultLog');
require('dotenv').config();

const _publicServiceEndpoint = process.env.API_HOSTNAME !== undefined ? ('https://' + process.env.API_HOSTNAME + '/') : 'http://localhost:4300/';
const _CHES_AUTH_ENDPOINT = process.env.CHES_AUTH_ENDPOINT || 'https://dev.loginproxy.gov.bc.ca/auth/realms/comsvcauth/protocol/openid-connect/token';
const _EMAIL_CLIENTID = process.env._EMAIL_CLIENTID || null;
const _EMAIL_CLIENT_SECRET = process.env._EMAIL_CLIENT_SECRET || null;
const _commonHostingEmailServiceEndpoint = process.env.CHES_ENDPOINT || 'https://ches-dev.api.gov.bc.ca/';
const _CHES_emailMergeAPI = 'api/v1/emailMerge';

// Runtime output
if (_EMAIL_CLIENTID === null) {
    defaultLog.error('*******************************************************************');
    defaultLog.error('_EMAIL_CLIENTID NOT SET');
    defaultLog.error('*******************************************************************');
}
if (_EMAIL_CLIENT_SECRET === null) {
    defaultLog.error('*******************************************************************');
    defaultLog.error('_EMAIL_CLIENT_SECRET NOT SET');
    defaultLog.error('*******************************************************************');
}

const getEmailToken = async function() {
    return await axios.post(_CHES_AUTH_ENDPOINT,
        qs.stringify({
            'client_id': _EMAIL_CLIENTID,
            'client_secret': _EMAIL_CLIENT_SECRET,
            'grant_type': 'client_credentials',
        }),
        {
            headers: {
                'content-type': 'application/x-www-form-urlencoded'
            }
        }
    );
}

exports.sendConfirmEmail = async function ( projectName, email, confirmKey) {
    // Set/Get the template
    let emailTemplate = {
        "bodyType": "text",
        "body": "Please click the following link to confirm your email address\r\n\r\n {{ confirmHost }}confirm-email/{{ email }}/{{ confirmKey }} \r\n\r\nThis is an automatically generated email, please do not reply.\r\n\r\n",
        "contexts": [
            {
                "to": [email],
                "context": {
                    "projectName": projectName,
                    "confirmKey": confirmKey,
                    "confirmHost": _publicServiceEndpoint,
                    "email": email
                }
            }
        ],
        "encoding": "utf-8",
        "from": "BC Gov Land Use Planning <noreply@gov.bc.ca>",
        "priority": "normal",
        "subject": "Confirming your email for the {{ projectName }} distribution list"
    };

    // Send the emails to the CHES (Common Hosted Email Service)
    try {
        const emailToken = await getEmailToken();

        if (emailToken && emailToken.data && emailToken.data.access_token) {
            // Send the confirm email
            await axios.post(
                _commonHostingEmailServiceEndpoint + _CHES_emailMergeAPI,
                emailTemplate,
                {
                    headers: {
                        "Authorization": 'Bearer ' + emailToken.data.access_token,
                        "Content-Type": 'application/json'
                    }
                }
            );
            defaultLog.info("Email Sent");
        } else {
            defaultLog.error("Couldn't get a proper token", emailToken);
        }
    } catch (err) {
        defaultLog.error("Error:", err);
        // fall through, don't block execution on this.
    }

    return;
};

exports.sendWelcomeEmail = async function (projectName, email) {
    // Set/Get the template
    let emailTemplate = {
        "bodyType": "text",
        "body": "Thank you for signing up. Your email has been added to the {{ projectName }} distribution list and you are now set up to receive project updates directly to your inbox.\r\n\r\nIf at any time you want to unsubscribe, click the link below.\r\n\r\n{{ unsubcribeHost }}unsubscribe\r\n\r\nThis is an automatically generated email, please do not reply.\r\n\r\n",
        "contexts": [
            {
                "to": [email],
                "context": {
                    "projectName": projectName,
                    "unsubcribeHost": _publicServiceEndpoint,
                    "email": email
                }
            }
        ],
        "encoding": "utf-8",
        "from": "BC Gov Land Use Planning  <noreply@gov.bc.ca>",
        "priority": "normal",
        "subject": "Welcome to the {{ projectName }} distribution list"
    };

    // Send the emails to the CHES (Common Hosted Email Service)
    try {
        const emailToken = await getEmailToken();

        if (emailToken && emailToken.data && emailToken.data.access_token) {
            // Send the welcome email
            await axios.post(
                _commonHostingEmailServiceEndpoint + _CHES_emailMergeAPI,
                emailTemplate,
                {
                    headers: {
                        "Authorization": 'Bearer ' + emailToken.data.access_token,
                        "Content-Type": 'application/json'
                    }
                }
            );
            defaultLog.info("Email Sent");
        } else {
            defaultLog.error("Couldn't get a proper token", emailToken);
        }
    } catch (err) {
        defaultLog.error("Error:", err);
        // fall through, don't block execution on this.
    }

    return;
};