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

const getEmailToken = async function () {
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
};

/**
 * Build formatted project list for email templates.
 * 
 * @param {string[]} projectNames Array of project names
 * @returns {object} Object containing formatted projectList string
 */
const buildProjectEmailContext = (projectNames) => {
    const names = Array.isArray(projectNames) ? projectNames.filter(Boolean) : [];
    const projectList = names.length > 0
        ? names.map(name => `- ${name}`).join('\r\n')
        : '- Planning In Partnership';

    return { projectList };
};

/**
 * Send an email using the CHES API.
 * 
 * @param {object} emailTemplate The email template used by the CHES API
 * @returns {Promise<void>}
 */
const sendEmailViaCHES = async (emailTemplate) => {
    try {
        const emailToken = await getEmailToken();

        if (emailToken && emailToken.data && emailToken.data.access_token) {
            const response = await axios.post(
                _commonHostingEmailServiceEndpoint + _CHES_emailMergeAPI,
                emailTemplate,
                {
                    headers: {
                        "Authorization": 'Bearer ' + emailToken.data.access_token,
                        "Content-Type": 'application/json'
                    }
                }
            );
            defaultLog.info('Email sent successfully via CHES', {
                to: emailTemplate.contexts[0].to,
                subject: emailTemplate.subject
            });
            return response;
        } else {
            defaultLog.error("Couldn't get a valid CHES token", emailToken);
            throw new Error('Failed to obtain CHES authentication token');
        }
    } catch (err) {
        defaultLog.error('Error sending email via CHES:', err);
        throw err;
    }
};

/**
 * Send confirmation email for email subscription.
 * 
 * @param {string[]} projectNames Array of project names the user is subscribing to
 * @param {string} email Email address to send confirmation to
 * @param {string} confirmKey Unique confirmation key for verifying the subscription
 * @returns {Promise<void>}
 */
exports.sendConfirmEmail = async function (projectNames, email, confirmKey) {
    const { projectList } = buildProjectEmailContext(projectNames);
    const emailTemplate = {
        "bodyType": "text",
        "body": "Please confirm your email address to receive updates from Planning In Partnership.\r\n\r\n" +
            "You are set to receive messages about:\r\n" +
            "{{ projectList }}\r\n\r\n" +
            "Confirm your subscription:\r\n" +
            "{{ confirmHost }}confirm-email/{{ email }}/{{ confirmKey }}\r\n\r\n" +
            "This is an automatically generated email, please do not reply.\r\n\r\n",
        "contexts": [
            {
                "to": [email],
                "context": {
                    "projectList": projectList,
                    "confirmKey": confirmKey,
                    "confirmHost": _publicServiceEndpoint,
                    "email": email
                }
            }
        ],
        "encoding": "utf-8",
        "from": "BC Gov Planning In Partnership <noreply@gov.bc.ca>",
        "priority": "normal",
        "subject": "Confirm your Planning In Partnership email subscription"
    };

    try {
        await sendEmailViaCHES(emailTemplate);
    } catch (err) {
        defaultLog.error('Failed to send confirmation email:', { email, error: err.message });
        // Don't throw - allow the subscription process to continue even if email fails
    }
};

/**
 * Send welcome email after subscription confirmation.
 * 
 * @param {string[]} projectNames Array of project names the user is subscribed to
 * @param {string} email Email address to send welcome message to
 * @returns {Promise<void>}
 */
exports.sendWelcomeEmail = async function (projectNames, email) {
    const { projectList } = buildProjectEmailContext(projectNames);
    const emailTemplate = {
        "bodyType": "text",
        "body": "Thank you for confirming your email address. You are now subscribed to updates for:\r\n" +
            "{{ projectList }}\r\n\r\n" +
            "You will receive project updates directly to your inbox.\r\n\r\n" +
            "If at any time you want to unsubscribe, click the link below:\r\n" +
            "{{ unsubcribeHost }}unsubscribe\r\n\r\n" +
            "This is an automatically generated email, please do not reply.\r\n\r\n",
        "contexts": [
            {
                "to": [email],
                "context": {
                    "projectList": projectList,
                    "unsubcribeHost": _publicServiceEndpoint,
                    "email": email
                }
            }
        ],
        "encoding": "utf-8",
        "from": "BC Gov Planning In Partnership <noreply@gov.bc.ca>",
        "priority": "normal",
        "subject": "Welcome to Planning In Partnership updates"
    };

    try {
        await sendEmailViaCHES(emailTemplate);
    } catch (err) {
        defaultLog.error('Failed to send welcome email:', { email, error: err.message });
        // Don't throw - allow the confirmation process to complete even if email fails
    }
};

/**
 * Send project added email for users who are already confirmed and subscribing to an additional project.
 * 
 * @param {string[]} projectNames Array of project names (typically just the new project)
 * @param {string} email Email address to send notification to
 * @returns {Promise<void>}
 */
exports.sendProjectAddedEmail = async function (projectNames, email) {
    const { projectList } = buildProjectEmailContext(projectNames);
    const emailTemplate = {
        "bodyType": "text",
        "body": "You have been added to updates for:\r\n" +
            "{{ projectList }}\r\n\r\n" +
            "You will receive project updates directly to your inbox.\r\n\r\n" +
            "If at any time you want to unsubscribe, click the link below:\r\n" +
            "{{ unsubcribeHost }}unsubscribe\r\n\r\n" +
            "This is an automatically generated email, please do not reply.\r\n\r\n",
        "contexts": [
            {
                "to": [email],
                "context": {
                    "projectList": projectList,
                    "unsubcribeHost": _publicServiceEndpoint,
                    "email": email
                }
            }
        ],
        "encoding": "utf-8",
        "from": "BC Gov Planning In Partnership <noreply@gov.bc.ca>",
        "priority": "normal",
        "subject": "You've been added to new Planning In Partnership project updates"
    };

    try {
        await sendEmailViaCHES(emailTemplate);
    } catch (err) {
        defaultLog.error('Failed to send project added email:', { email, error: err.message });
        // Don't throw - allow the subscription process to complete even if email fails
    }
};

/**
 * Send an email using the CHES API (used for contact form emails).
 * 
 * @param {object} emailTemplate The email template used by the CHES API
 * @returns {Promise<void>}
 */
const sendEmail = async (emailTemplate) => {
    try {
        await sendEmailViaCHES(emailTemplate);
    } catch (error) {
        defaultLog.error('Failed to send email:', error);
        // Don't throw - log the error but allow execution to continue
    }
};

/**
 * Build the email template used by the CHES API.
 * 
 * @param {string} subject The email subject line
 * @param {string} body The body of the email
 * @param {string[]} toAddresses An array of email addresses to send to
 * @param {string} fromAddress The email address to mark as "from"
 * @param {object[]} attachments The attachments to send with the email
 * @returns {object} Email template object for CHES API
 */
const buildEmailTemplate = (subject, body, toAddresses, fromAddress, attachments = null) => {
    const emailTemplate = {
        "bodyType": "text",
        "body": body,
        "contexts": [
            {
                "to": toAddresses,
                "context": {}
            }
        ],
        "encoding": "utf-8",
        "from": fromAddress,
        "priority": "normal",
        "subject": subject,
    };

    if (Array.isArray(attachments) && attachments.length > 0) {
        emailTemplate.attachments = attachments;
    }

    return emailTemplate;
};

/**
 * Handle contact form submission by sending confirmation and notification emails.
 * 
 * @param {string} projectName Name of the project the contact form is for
 * @param {object} contactFormResponse Contact form data (name, email, message, files)
 * @param {string[]} recipients Array of email addresses to notify
 * @returns {Promise<void>}
 */
exports.handleContactFormResponse = async (projectName, contactFormResponse, recipients) => {
    if (!Array.isArray(recipients) || recipients.length === 0) {
        throw new Error('Invalid recipients. Could not send email.');
    }

    // Build the email template to send to the user as confirmation
    const confirmationToAddresses = [contactFormResponse.email];
    const confirmationSubject = `Contact us message received for ${projectName}`;
    const confirmationBody = `Thank you for contacting the ${projectName} project team! We'll respond to your request shortly.`;
    const confirmationFromAddress = recipients[0];
    const confirmationEmailTemplate = buildEmailTemplate(
        confirmationSubject,
        confirmationBody,
        confirmationToAddresses,
        confirmationFromAddress
    );

    // Build the email template to send to the project leads
    const formSubmissionToAddresses = recipients;
    const formSubmissionSubject = `New message received for the ${projectName} project`;
    const formSubmissionBody = `You've received the following message from ${contactFormResponse.name}:\r\n\r\n${contactFormResponse.message}`;
    const formSubmissionFromAddress = contactFormResponse.email;
    const formSubmissionAttachments = contactFormResponse.files
        ? contactFormResponse.files.map(file => ({
            filename: file.originalname,
            content: file.buffer.toString('base64'),
            encoding: 'base64',
            contentType: file.mimetype
        }))
        : null;
    const formSubmissionTemplate = buildEmailTemplate(
        formSubmissionSubject,
        formSubmissionBody,
        formSubmissionToAddresses,
        formSubmissionFromAddress,
        formSubmissionAttachments
    );

    // Send the emails to the CHES (Common Hosted Email Service)
    try {
        await Promise.all([
            sendEmail(confirmationEmailTemplate),
            sendEmail(formSubmissionTemplate)
        ]);
    } catch (e) {
        defaultLog.error('Error sending contact form emails:', e);
        throw e;
    }
};