var { remove, indexOf, assignIn } = require('lodash');
var defaultLog = require('winston').loggers.get('defaultLog');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');
var Email = require('../helpers/email');
const csv = require('csv');
const transform = require('stream-transform');
const ENABLE_VIRUS_SCANNING = process.env.ENABLE_VIRUS_SCANNING || false;

/**
 * 
 * Shared options 
 */

var getSanitizedFields = function (fields) {
  return remove(fields, function (f) {
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

exports.protectedOptions = function (args, res) {
  defaultLog.info('EMAIL SUBSCRIBE PROTECTED OPTIONS');
  res.status(200).send();
}

/**
 * Public
 */

exports.publicHead = async function (args, res) {
  defaultLog.info('EMAIL SUBSCRIBE PUBLIC HEAD');
  const fields = getSanitizedFields(args.swagger.params.fields.value);

  // Set query type
  assignIn(query, { '_schemaName': 'EmailSubscribe' });

  var data = await Utils.runDataQuery('EmailSubscribe',
    ['public'],
    query,
    fields, // Fields
    null, // sort warmup
    null, // sort
    null, // skip
    null, // limit
    true); // count
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
    .filter(Boolean);

  if (names.length === 0 && fallbackName) {
    return [fallbackName];
  }

  return names;
};

// subscribe a new email address
exports.unProtectedPost = async function (args, res) {
  defaultLog.info('EMAIL SUBSCRIBE PUBLIC POST');

  const obj = args.swagger.params.emailSubscribe.value;
  const requestedEmail = obj.email;
  const sendGenericSuccess = () => Actions.sendResponse(res, 200, { message: 'Subscription request processed' });

  let requestedProjectId;
  try {
    requestedProjectId = mongoose.Types.ObjectId(obj.project);
  } catch (err) {
    defaultLog.warn('Invalid project identifier supplied for subscription', { email: requestedEmail, project: obj.project });
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
      defaultLog.info('Sent confirmation email for new subscription', { email: requestedEmail, projects: projectNames });

      return sendGenericSuccess();
    }

    const alreadySubscribedToProject = subscription.project.some(
      projId => projId && projId.toString() === requestedProjectId.toString()
    );

    let subscriptionChanged = false;

    if (!alreadySubscribedToProject) {
      subscription.project.push(requestedProjectId);
      subscriptionChanged = true;
    }

    // Handle unconfirmed subscriptions
    if (!subscription.confirmed) {
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
    defaultLog.error('Error processing email subscription:', e);
    return Actions.sendResponse(res, 500, { error: 'Internal server error' });
  }
};

// Confirm a new email address
exports.unProtectedPut = async function (args, res) {
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
      return Actions.sendResponse(res, 200, { message: 'Email already confirmed' });
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
    defaultLog.error('Error confirming email subscription:', e);
    return Actions.sendResponse(res, 500, { error: 'Internal server error' });
  }
};

// unsubscribe from updates
exports.unProtectedDelete = async function (args, res, next) {
  defaultLog.info('EMAIL SUBSCRIBE PUBLIC DELETE');

  // verify that the email and key have been set in the request
  if (!(args.swagger.params.email && args.swagger.params.email.value)) {
    return Actions.sendResponse(res, 404, 'Not found');
  }

  var emailAddress = args.swagger.params.email.value;
  var emailIds;
  defaultLog.info('Delete email subscribe:', emailAddress);

  var EmailSubscribe = mongoose.model('EmailSubscribe');

  // find the object ID(s) based on the email address
  await EmailSubscribe.find({ _schemaName: 'EmailSubscribe', email: emailAddress }, null, function (err, entities) {
    if (err) {
      defaultLog.error('Error finding email subscribe object from email', err);
      return Actions.sendResponse(res, 404, err);
    }

    if (entities) {
      emailIds = entities.map(entity => entity._id);
    }
  });

  try {
    for (const emailId of emailIds) {
      var es = await EmailSubscribe.findOneAndRemove({ _id: emailId });
      Utils.recordAction('Delete', 'EmailSubscribe', 'public', emailId);
      defaultLog.info('Email unsubscribed:', es);
    }
    return Actions.sendResponse(res, 200, es);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
}

/**
 * Admin
 */

// get list of subscribers

exports.protectedHead = async function (args, res) {
  defaultLog.info('');
  var query = {};

  if (args.swagger.params.email && args.swagger.params.email.value) {
    query = Utils.buildQuery('_id', args.swagger.params.email.value, query);
  }

  // Set query type
  assignIn(query, { '_schemaName': 'EmailSubscribe' });

  var data = await Utils.runDataQuery('EmailSubscribe',
    args.swagger.operation['x-security-scopes'],
    query,
    ['_id',
      'tags'], // Fields
    null, // sort warmup
    null, // sort
    null, // skip
    null, // limit
    true); // count
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

exports.protectedGet = async function (args, res, next) {
  defaultLog.info('EMAIL SUBSCRIBE PROTECTED GET');

  var query = {}, sort = {}, skip = null, limit = null, count = false, filter = [];

  // Build match query for project ID
  if (args.swagger.params.project && args.swagger.params.project.value) {
    defaultLog.info('ES Project ID', args.swagger.params.project.value);
    assignIn(query, { project: mongoose.Types.ObjectId(args.swagger.params.project.value), confirmed: true });
  }

  // Sort
  if (args.swagger.params.sortBy && args.swagger.params.sortBy.value) {
    args.swagger.params.sortBy.value.forEach(function (value) {
      var order_by = value.charAt(0) == '-' ? -1 : 1;
      var sort_by = value.slice(1);
      sort[sort_by] = order_by;
    }, this);
  }

  // Skip and limit
  var processedParameters = Utils.getSkipLimitParameters(args.swagger.params.pageSize, args.swagger.params.pageNum);
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
    var data = await Utils.runDataQuery('EmailSubscribe',
      args.swagger.params.auth_payload.client_roles,
      args.swagger.params.auth_payload.idir_user_guid,
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null,
      sort, // sort
      skip, // skip
      limit, // limit
      count); // count
    //Utils.recordAction('Get', 'EmailSubscribe', args.swagger.params.auth_payload.preferred_username, args.swagger.params.email && args.swagger.params.email.value ? args.swagger.params.email.value : null);
    defaultLog.info('Got email subscribers:', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

// Admin delete email
exports.protectedDelete = async function (args, res, next) {
  defaultLog.info('EMAIL SUBSCRIBE PROTECTED DELETE');

  // verify that the email and key have been set in the request
  if (!(args.swagger.params.email && args.swagger.params.email.value)) {
    defaultLog.info('Email not found');
    return Actions.sendResponse(res, 404, 'Not found');
  }

  let emailAddress = args.swagger.params.email.value;
  let projectId = args.swagger.params.projectId.value;
  let emailId;
  let projectList = [];
  defaultLog.info('Delete email subscribe:', emailAddress);

  var EmailSubscribe = mongoose.model('EmailSubscribe');

  // find the object ID based on the email address
  await EmailSubscribe.findOne({ email: emailAddress }, null, async function (err, entity) {
    if (err) {
      defaultLog.error('Error finding email subscribe object from email', err);
      return Actions.sendResponse(res, 404, err);
    }

    if (entity) {
      emailId = entity._id;
      projectList = entity.project;

      // check if project id is in project list
      const index = projectList.indexOf(projectId);
      if (index > -1) {
        projectList.splice(index, 1);
        if (projectList.length > 0) {
          // update existing email object with new project list
          try {
            var es = await EmailSubscribe.updateOne({ _id: emailId }, { $set: { project: projectList } });
            Utils.recordAction('Delete', 'EmailSubscribe', args.swagger.params.auth_payload.preferred_username, emailId);
            defaultLog.info('Email deleted from one project:', es);
            return Actions.sendResponse(res, 200, es);
          } catch (e) {
            defaultLog.error('Error removing user subscription from project', e);
            return Actions.sendResponse(res, 500, e);
          }
        } else {
          // delete email object
          try {
            var es = await EmailSubscribe.findOneAndRemove({ _id: emailId });
            Utils.recordAction('Delete', 'EmailSubscribe', args.swagger.params.auth_payload.preferred_username, emailId);
            defaultLog.info('Email deleted from system:', emailId);
            return Actions.sendResponse(res, 200, es);
          } catch (e) {
            defaultLog.error('Error deleting email subscription entry', e);
            return Actions.sendResponse(res, 500, e);
          }
        }
      } else {
        // if not return 404
        defaultLog.info('Project ID not found: ', projectId);
        return Actions.sendResponse(res, 404, 'Project ID not found');
      }

    }
  });

}


// Export all subscribers
exports.protectedExport = async function (args, res) {
  defaultLog.info('EMAIL SUBSCRIBE PROTECTED EXPORT');
  const projectId = args.swagger.params.projectId.value;

  const match = {
    _schemaName: 'EmailSubscribe',
    project: mongoose.Types.ObjectId(projectId),
    confirmed: true
  };

  const aggregation = [
    {
      $match: match
    }
  ];

  const data = mongoose.model('EmailSubscribe')
    .aggregate(aggregation)
    .cursor()
    .exec();

  const filename = `export_${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-disposition', `attachment; filename=${filename}`);
  res.writeHead(200, { 'Content-Type': 'text/csv' });

  res.flushHeaders();

  data
    .pipe(transform(function (d) {
      delete d.__v
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

      return { ...d };
    }))
    .pipe(csv.stringify({ header: true }))
    .pipe(res);
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
        files.map(file => Utils.avScan(file.buffer).then(clean => ({ file, clean })))
      );

      const failed = results.filter((result) => !result.clean);

      if (failed.length > 0) {
        failed.forEach((result) => {
          defaultLog.warn('File failed virus scan:', result.file.originalname);
        });
        return Actions.sendResponse(res, 400, { message: 'One or more files failed virus check.' });
      }

      results.forEach((result) => { defaultLog.info('File passed virus scan:', result.file.originalname); });

    } catch (err) {
      defaultLog.error('Error during virus scanning:', err);
      return Actions.sendResponse(res, 500, { message: 'Virus scan failed unexpectedly.' });
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
    defaultLog.error('Error sending email:', e);
    return Actions.sendResponse(res, 400, false);
  }
};