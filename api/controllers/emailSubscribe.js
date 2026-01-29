const { remove, indexOf, assignIn } = require('lodash');
const { Readable, Transform } = require('node:stream') ;
const defaultLog = require('winston').loggers.get('defaultLog');
const mongoose = require('mongoose');
const Actions = require('../helpers/actions');
const Utils = require('../helpers/utils');
const Email = require('../helpers/email');
const randToken = require('rand-token');
const csv = require('csv');
const { pipeline } = require('stream/promises');
const ENABLE_VIRUS_SCANNING = process.env.ENABLE_VIRUS_SCANNING || false;

/**
 * 
 * Shared options 
 */

const getSanitizedFields = (fields = []) => {
  return remove(fields, (f) => {
    return (indexOf([
      'email',
      'project',
      'confirmed',
      'dateSubscribed',
      'dateConfirmed',
      'read',
      'write',
      'delete'
    ], f) !== -1);
  });
};

exports.protectedOptions = (args, res) => {
  defaultLog.info('EMAIL SUBSCRIBE PROTECTED OPTIONS');
  res.status(200).send();
}

/**
 * Public
 */

exports.publicHead = async (args, res) => {
  defaultLog.info('EMAIL SUBSCRIBE PUBLIC HEAD');
  const fields = getSanitizedFields(args.swagger.params.fields && args.swagger.params.fields.value);
  const query = {};

  // Set query type
  assignIn(query, { '_schemaName': 'EmailSubscribe' });

  const data = await Utils.runDataQuery(
    'EmailSubscribe',
    ['public'],
    null,
    query,
    fields, // Fields
    null, // sort warmup
    null, // sort
    null, // skip
    null, // limit
    true  // count
  );

  Utils.recordAction('Head', 'EmailSubscribe', 'public');
  res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items : 0);
  defaultLog.info('Got email subscribe headers:', data);
  return Actions.sendResponse(res, 200, data);
};

/**
 * Fetch project names from the database, maintaining the order of provided IDs.
 * 
 * @param {Model} ProjectModel Mongoose Project model
 * @param {ObjectId[]} projectIds Array of project ObjectIds
 * @param {string} fallbackName Optional fallback name if no projects found
 * @returns {Promise<string[]>} Array of project names in the same order as input IDs
 */
const fetchProjectNames = async (ProjectModel, projectIds, fallbackName) => {
  if (!Array.isArray(projectIds) || projectIds.length === 0) {
    return fallbackName ? [fallbackName] : [];
  }

  const orderedIds = projectIds.map(id => id && id.toString()).filter(Boolean);
  if (orderedIds.length === 0) {
    return fallbackName ? [fallbackName] : [];
  }

  const uniqueIds = [...new Set(orderedIds)];
  const projects = await ProjectModel.find({ _id: { $in: uniqueIds } }, { name: 1 }).lean();

  // Create a map for O(1) lookup
  const projectMap = new Map(projects.map(p => [p._id.toString(), p.name]));

  // Map IDs to names while maintaining order
  const names = orderedIds
    .map(id => projectMap.get(id))
    // throw out any undefined project names (in case of missing projects)
    .filter(Boolean);

  if (names.length === 0 && fallbackName) {
    return [fallbackName];
  }

  return names;
};

// subscribe a new email address
exports.unProtectedPost = async (args, res) => {
  defaultLog.info('EMAIL SUBSCRIBE PUBLIC POST');

  const subscriptionRequest = args.swagger.params.emailSubscribe.value;
  const requestedEmail = subscriptionRequest.email;
  const sendGenericSuccess = () => Actions.sendResponse(res, 200, { message: 'Subscription request processed' });

  let requestedProjectId;
  try {
    requestedProjectId = mongoose.Types.ObjectId(subscriptionRequest.project);
  } catch (e) {
    defaultLog.error(
      'Invalid project identifier supplied for subscription, email subscribe unprotected post failed.',
      {
        email: requestedEmail,
        project: subscriptionRequest.project,
        message: e && e.message,
        stack: e && e.stack,
      },
    );
    return sendGenericSuccess();
  }

  defaultLog.info('Incoming subscription request:', { email: requestedEmail, project: requestedProjectId });

  const EmailSubscribe = mongoose.model('EmailSubscribe');
  const Project = mongoose.model('Project');

  try {
    const now = new Date();
    const requestedProject = await Project.findById(requestedProjectId).lean();
    const requestedProjectName = requestedProject ? requestedProject.name : 'Planning in Partnership';

    let subscription = await EmailSubscribe.findOne({
      _schemaName: 'EmailSubscribe',
      email: requestedEmail
    });

    let subscriptionChanged = false;

    // Case 1: No existing subscription - create new record and send confirmation email
    if (!subscription) {
      subscription = new EmailSubscribe({
        _schemaName: 'EmailSubscribe',
        email: requestedEmail,
        project: [requestedProjectId],
        confirmed: false,
        dateSubscribed: now,
        dateConfirmed: null,
        read: ['staff', 'sysadmin'],
        write: ['staff', 'sysadmin'],
        delete: ['staff', 'sysadmin']
      });

      const savedSubscription = await subscription.save();
      Utils.recordAction('Post', 'EmailSubscribe', 'public', savedSubscription._id);
      defaultLog.info('Created new email subscription:', savedSubscription._id);

      const projectNames = await fetchProjectNames(Project, savedSubscription.project, requestedProjectName);
      await Email.sendConfirmEmail(projectNames, requestedEmail, savedSubscription.confirmKey);

      return sendGenericSuccess();
    }

    const alreadySubscribedToProject = subscription.project.some(
      projId => projId && projId.toString() === requestedProjectId.toString()
    );

    if (!alreadySubscribedToProject) {
      subscription.project.push(requestedProjectId);
      subscriptionChanged = true;
    }

    // Handle unconfirmed subscriptions
    if (!subscription.confirmed) {
      if (!subscription.confirmKey) {
        subscription.confirmKey = randToken.generate(64);
        subscriptionChanged = true;
        defaultLog.info('Generated missing confirmation key for existing subscription', {
          subscriptionId: subscription._id
        });
      }

      const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
      const twentyFourHoursAgo = new Date(now.getTime() - TWENTY_FOUR_HOURS_MS);
      const shouldSendConfirmEmail = !subscription.dateSubscribed || subscription.dateSubscribed <= twentyFourHoursAgo;

      if (shouldSendConfirmEmail) {
        const projectNames = await fetchProjectNames(Project, subscription.project, requestedProjectName);
        await Email.sendConfirmEmail(projectNames, requestedEmail, subscription.confirmKey);
        subscription.dateSubscribed = now;
        subscriptionChanged = true;
        defaultLog.info('Sent confirmation email for pending subscription', {
          email: requestedEmail,
          projectCount: projectNames.length,
          subscriptionId: subscription._id
        });
      } else {
        defaultLog.info('Confirmation email recently sent; skipping resend', {
          subscriptionId: subscription._id,
          lastSent: subscription.dateSubscribed
        });
      }

      if (subscriptionChanged) {
        await subscription.save();
        Utils.recordAction('Put', 'EmailSubscribe', 'public', subscription._id);
      }

      return sendGenericSuccess();
    }

    // Handle confirmed subscriptions - send project added email for new project
    if (!alreadySubscribedToProject) {
      await subscription.save();
      Utils.recordAction('Put', 'EmailSubscribe', 'public', subscription._id);
      await Email.sendProjectAddedEmail([requestedProjectName], requestedEmail);
      defaultLog.info('Sent project added email for confirmed subscriber joining new project', {
        subscriptionId: subscription._id,
        project: requestedProjectName
      });
    } else {
      defaultLog.info('Confirmed subscriber attempted to re-subscribe to existing project', {
        subscriptionId: subscription._id,
        project: requestedProjectName
      });
    }

    return sendGenericSuccess();

  } catch (e) {
    defaultLog.error('Email subscribe unprotected post failed', {
      message: e && e.message,
      stack: e && e.stack,
    });
    return Actions.sendResponse(res, 500, { error: 'Internal server error' });
  }
};

// Confirm a new email address
exports.unProtectedPut = async (args, res) => {
  defaultLog.info('EMAIL SUBSCRIBE PUT - Confirmation request');

  // Validate required parameters
  if (!(args.swagger.params.email && args.swagger.params.email.value) ||
    !(args.swagger.params.confirmKey && args.swagger.params.confirmKey.value)) {
    defaultLog.warn('Missing email or confirmation key in request');
    return Actions.sendResponse(res, 403, 'Access denied');
  }

  const emailAddress = args.swagger.params.email.value;
  const confirmKey = args.swagger.params.confirmKey.value;
  const now = new Date();

  defaultLog.info('Processing email confirmation', { email: emailAddress });

  const EmailSubscribe = mongoose.model('EmailSubscribe');
  const Project = mongoose.model('Project');

  // Local helper to prevent account enumeration
  const sendGenericSuccess = () => Actions.sendResponse(res, 200, { message: 'Subscription request processed' });

  try {
    const subscription = await EmailSubscribe.findOne({
      _schemaName: 'EmailSubscribe',
      email: emailAddress
    });

    if (!subscription) {
      defaultLog.warn('No pending subscription found for confirmation attempt', { email: emailAddress });
      return Actions.sendResponse(res, 404, 'Subscription not found');
    }

    if (subscription.confirmKey !== confirmKey) {
      defaultLog.warn('Confirm key mismatch', {
        email: emailAddress,
        subscriptionId: subscription._id
      });
      return Actions.sendResponse(res, 403, 'Invalid confirmation key');
    }

    if (subscription.confirmed) {
      defaultLog.info('Email already confirmed', { email: emailAddress, subscriptionId: subscription._id });
      return sendGenericSuccess(); // Prevent account enumeration
    }

    // Confirm the subscription
    subscription.confirmed = true;
    subscription.dateConfirmed = now;
    await subscription.save();

    Utils.recordAction('Put', 'EmailSubscribe', 'public', subscription._id);

    // Fetch project names and send welcome email
    const projectNames = await fetchProjectNames(Project, subscription.project, 'Planning in Partnership');
    await Email.sendWelcomeEmail(projectNames, emailAddress);

    defaultLog.info('Email subscription confirmed successfully', {
      subscriptionId: subscription._id,
      projectCount: projectNames.length
    });

    return Actions.sendResponse(res, 200, { message: 'Subscription confirmed' });

  } catch (e) {
    defaultLog.error(
      'Error confirming email subscription, email subscribe unprotected put failed.',
      {
        message: e && e.message,
        stack: e && e.stack,
      },
    );
    return Actions.sendResponse(res, 500, { error: 'Internal server error' });
  }
};

// unsubscribe from updates
exports.unProtectedDelete = async (args, res /*, next */) => {
  defaultLog.info('EMAIL SUBSCRIBE PUBLIC DELETE');

  // verify that the email and key have been set in the request
  if (!(args.swagger.params.email && args.swagger.params.email.value)) {
    return Actions.sendResponse(res, 404, 'Not found');
  }

  const emailAddress = args.swagger.params.email.value;
  let emailIds = [];
  let es;
  defaultLog.info('Delete email subscribe:', emailAddress);

  const EmailSubscribe = mongoose.model('EmailSubscribe');

  try {
    // find the object ID(s) based on the email address  (refactor: await, no callback)
    const entities = await EmailSubscribe.find({ _schemaName: 'EmailSubscribe', email: emailAddress }).lean();
    if (entities && entities.length > 0) {
      emailIds = entities.map(entity => entity._id);
    }

    for (const emailId of emailIds) {
      es = await EmailSubscribe.findOneAndRemove({ _id: emailId });
      Utils.recordAction('Delete', 'EmailSubscribe', 'public', emailId);
      defaultLog.info('Email unsubscribed:', es);
    }
    return Actions.sendResponse(res, 200, es || {});
  } catch (e) {
    defaultLog.error('Email subscribe unprotected delete failed', {
      message: e && e.message,
      stack: e && e.stack,
    });
    return Actions.sendResponse(res, 400, e);
  }
}

/**
 * Admin
 */

// get list of subscribers

exports.protectedHead = async (args, res) => {
  defaultLog.info('');
  let query = {};

  if (args.swagger.params.email && args.swagger.params.email.value) {
    query = Utils.buildQuery('_id', args.swagger.params.email.value, query);
  }

  // Set query type
  assignIn(query, { '_schemaName': 'EmailSubscribe' });

  // Fixed runDataQuery args: include userGuid
  const data = await Utils.runDataQuery(
    'EmailSubscribe',
    args.swagger.operation['x-security-scopes'],
    args.swagger.params.auth_payload && args.swagger.params.auth_payload.idir_user_guid,
    query,
    ['_id', 'tags'], // Fields
    null, // sort warmup
    null, // sort
    null, // skip
    null, // limit
    true  // count
  );

  Utils.recordAction('Head', 'EmailSubscribe', args.swagger.params.auth_payload.preferred_username, args.swagger.params.email && args.swagger.params.email.value ? args.swagger.params.email.value : null);

  // /api/comment/ route, return 200 OK with 0 items if necessary
  if (!(args.swagger.params.email && args.swagger.params.email.value) || (data && data.length > 0)) {
    res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items : 0);
    defaultLog.info('Got email subscribe headers: ', data);
    return Actions.sendResponse(res, 200, data);
  } else {
    defaultLog.info('Could not retrieve email subscribe headers.');
    return Actions.sendResponse(res, 404, data);
  }
};

exports.protectedGet = async (args, res /*, next */) => {
  defaultLog.info('EMAIL SUBSCRIBE PROTECTED GET');

  let query = {}, sort = {}, skip = null, limit = null, count = false, filter = [];

  // Build match query for project ID
  if (args.swagger.params.project && args.swagger.params.project.value) {
    defaultLog.info('ES Project ID', args.swagger.params.project.value);
    assignIn(query, { project: mongoose.Types.ObjectId(args.swagger.params.project.value), confirmed: true });
  }

  // Sort
  if (args.swagger.params.sortBy && args.swagger.params.sortBy.value) {
    args.swagger.params.sortBy.value.forEach((value) => {
      const order_by = value.charAt(0) == '-' ? -1 : 1;
      const sort_by = value.slice(1);
      sort[sort_by] = order_by;
    }, this);
  }

  // Skip and limit
  const processedParameters = Utils.getSkipLimitParameters(args.swagger.params.pageSize, args.swagger.params.pageNum);
  skip = processedParameters.skip;
  limit = processedParameters.limit;

  // Count
  if (args.swagger.params.count && args.swagger.params.count.value) {
    count = args.swagger.params.count.value;
  }

  // Set query type
  assignIn(query, { '_schemaName': 'EmailSubscribe' });

  if (filter.length !== 0) {
    assignIn(query, { $or: filter });
  }

  try {
    const data = await Utils.runDataQuery(
      'EmailSubscribe',
      args.swagger.params.auth_payload.client_roles,
      args.swagger.params.auth_payload.idir_user_guid,
      query,
      getSanitizedFields(args.swagger.params.fields && args.swagger.params.fields.value), // Fields
      null,
      sort, // sort
      skip, // skip
      limit, // limit
      count  // count
    );
    //Utils.recordAction('Get', 'EmailSubscribe', args.swagger.params.auth_payload.preferred_username, args.swagger.params.email && args.swagger.params.email.value ? args.swagger.params.email.value : null);
    defaultLog.info('Got email subscribers:', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error('Email subscribe protected get failed', {
      message: e && e.message,
      stack: e && e.stack,
    });
    return Actions.sendResponse(res, 400, e);
  }
};

// Admin delete email
exports.protectedDelete = async (args, res) => {
  defaultLog.info('EMAIL SUBSCRIBE PROTECTED DELETE');

  // verify that the email and key have been set in the request
  if (!(args.swagger.params.email && args.swagger.params.email.value)) {
    defaultLog.info('Email not found');
    return Actions.sendResponse(res, 404, 'Not found');
  }

  const emailAddress = args.swagger.params.email.value;
  const projectId = args.swagger.params.projectId && args.swagger.params.projectId.value;
  let emailId;
  let projectList = [];
  defaultLog.info('Delete email subscribe:', emailAddress);

  const EmailSubscribe = mongoose.model('EmailSubscribe');

  try {
    // find the object ID based on the email address  (refactor: await, no callback)
    const entity = await EmailSubscribe.findOne({ email: emailAddress });

    if (!entity) {
      defaultLog.error('Email subscription entry not found for deletion');
      return Actions.sendResponse(res, 404, 'Not found');
    }

    emailId = entity._id;
    projectList = Array.isArray(entity.project) ? [...entity.project] : [];

    // check if project id is in project list
    const index = projectList.findIndex(
      (p) => p && p.toString() === String(projectId),
    );
    if (index > -1) {
      projectList.splice(index, 1);
      if (projectList.length > 0) {
        // update existing email object with new project list
        try {
          const es = await EmailSubscribe.updateOne(
            { _id: emailId },
            { $set: { project: projectList } },
          );
          Utils.recordAction(
            'Delete',
            'EmailSubscribe',
            args.swagger.params.auth_payload.preferred_username,
            emailId,
          );
          defaultLog.info('Email deleted from one project:', es);
          return Actions.sendResponse(res, 200, es);
        } catch (e) {
          defaultLog.error(
            'Error removing user subscription from project, email subscribe protected delete failed.',
            {
              message: e && e.message,
              stack: e && e.stack,
            },
          );
          return Actions.sendResponse(res, 500, e);
        }
      } else {
        // delete email object
        try {
          const es = await EmailSubscribe.findOneAndRemove({ _id: emailId });
          Utils.recordAction(
            'Delete',
            'EmailSubscribe',
            args.swagger.params.auth_payload.preferred_username,
            emailId,
          );
          defaultLog.info('Email deleted from system:', emailId);
          return Actions.sendResponse(res, 200, es);
        } catch (e) {
          defaultLog.error(
            'Error deleting email subscription entry, email subscribe protected delete failed.',
            {
              message: e && e.message,
              stack: e && e.stack,
            },
          );
          return Actions.sendResponse(res, 500, e);
        }
      }
    } else {
      // if not return 404
      defaultLog.warn(
        'Project ID not found during email subscribe protected delete. ',
        projectId,
      );
      return Actions.sendResponse(res, 404, 'Project ID not found');
    }
  } catch (e) {
    defaultLog.error(
      'Error finding email subscribe object in email subscribe protected delete.',
      {
        message: e && e.message,
        stack: e && e.stack,
      },
    );
    return Actions.sendResponse(res, 404, e);
  }
}


// Export all subscribers
exports.protectedExport = async (args, res) => {
  defaultLog.info('EMAIL SUBSCRIBE PROTECTED EXPORT');
  const projectId = args.swagger.params.projectId.value;

  const match = {
    _schemaName: 'EmailSubscribe',
    project: mongoose.Types.ObjectId(projectId),
    confirmed: true
  };

  const aggregation = [
    { $match: match }
  ];

  const data = await mongoose
    .model('EmailSubscribe')
    .aggregate(aggregation)
    .exec();

  const filename = `export_${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.writeHead(200, { 'Content-Type': 'text/csv' });

  const scrubbed = new Transform({
    objectMode: true,
    transform(d, _enc, cb) {
      delete d.__v;
      delete d._id;
      delete d._schemaName;
      delete d.confirmKey;
      delete d.project;
      delete d.confirmed;
      delete d.dateSubscribed;
      delete d.dateConfirmed;
      delete d.read;
      delete d.write;
      delete d.delete;
      cb(null, d);
    }
  });

  const csvOut = csv.stringify({ header: true });

  await pipeline(
    Readable.from(data),
    scrubbed,
    csvOut,
    res
  );
}

exports.handleContactFormResponse = async (args, res) => {
  // Swagger usually hides req/res, so let's define the request:
  const req = args.request || args.req || res.req;

  // Grab the form fields and files
  const { name, email, message, project } = req.body;
  const files = req.files;

  // Check for viruses
  defaultLog.info(`Virus scanning is ${ENABLE_VIRUS_SCANNING ? '' : 'not '} enabled.`);
  if ('true' === ENABLE_VIRUS_SCANNING && Array.isArray(files) && files.length > 0) {
    try {
      const results = await Promise.all(
        files.map((file) =>
          Utils.avScan(file.buffer).then((clean) => ({ file, clean })),
        ),
      );

      const failed = results.filter((result) => !result.clean);

      if (failed.length > 0) {
        failed.forEach((result) => {
          defaultLog.warn('File failed virus scan:', result.file.originalname);
        });
        return Actions.sendResponse(res, 400, {
          message: 'One or more files failed virus check.',
        });
      }

      results.forEach((result) => {
        defaultLog.info('File passed virus scan:', result.file.originalname);
      });
    } catch (e) {
      defaultLog.error(
        'Error during virus scanning in email subscribe handle contact form response.',
        {
          message: e && e.message,
          stack: e && e.stack,
        },
      );
      return Actions.sendResponse(res, 500, {
        message: 'Virus scan failed unexpectedly.',
      });
    }
  }

  defaultLog.info('HANDLE CONTACT FORM RESPONSE');
  defaultLog.info('Incoming fields:', { name, email, message, project });
  defaultLog.info((Array.isArray(files) && 0 < files.length ? `${files.length} ` : 'No ') + 'files are attached to the form');

  let projectName = 'Planning in Partnership';
  let recipients = [];

  try {
    const Project = mongoose.model('Project');
    const entity = await Project.findOne({ _id: project });
    if (entity) {
      projectName = entity.name;
      recipients = entity.contactFormEmails;
    }

    const contactForm = { name, email, message, project };
    if (Array.isArray(files) && files.length > 0) {
      contactForm.files = files;
    }

    await Email.handleContactFormResponse(projectName, contactForm, recipients);
    return Actions.sendResponse(res, 200, true);
  } catch (e) {
    defaultLog.error(
      'Error sending email in email subscribe handle contact form response.',
      {
        message: e && e.message,
        stack: e && e.stack,
      },
    );
    return Actions.sendResponse(res, 400, false);
  }
};
