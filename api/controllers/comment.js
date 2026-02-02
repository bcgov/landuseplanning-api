const _ = require('lodash');
const defaultLog = require('winston').loggers.get('defaultLog');
const mongoose = require('mongoose');
const csv = require('csv');
const transform = require('stream-transform');

const Actions = require('../helpers/actions');
const Utils = require('../helpers/utils');

const getSanitizedFields = (fields) => {
  return _.remove(fields, (f) => {
    return (
      _.indexOf(
        [
          'author',
          'project',
          'comment',
          'commentId',
          'dateAdded',
          'datePosted',
          'dateUpdated',
          'documents',
          'eaoNotes',
          'eaoStatus',
          'isAnonymous',
          'location',
          'period',
          'proponentNotes',
          'proponentStatus',
          'publishedNotes',
          'rejectedNotes',
          'rejectedReason',
          'valuedComponents',
          'read',
          'write',
          'delete',
        ],
        f,
      ) !== -1
    );
  });
};

const setPermissionsFromEaoStatus = (status, comment) => {
  switch (status) {
    case 'Published':
      defaultLog.info('Publishing Comment');
      comment.eaoStatus = 'Published';
      comment.read = ['staff', 'sysadmin'];
      break;
    case 'Pending':
      defaultLog.info('Pending Comment');
      comment.eaoStatus = 'Pending';
      comment.read = ['staff', 'sysadmin'];
      break;
    case 'Deferred':
      defaultLog.info('Deferring Comment');
      comment.eaoStatus = 'Deferred';
      comment.read = ['staff', 'sysadmin'];
      break;
    case 'Rejected':
      defaultLog.info('Rejecting Comment');
      comment.eaoStatus = 'Rejected';
      comment.read = ['staff', 'sysadmin'];
      break;
    case 'Reset':
      defaultLog.info('Reseting Comment Status');
      comment.eaoStatus = 'Pending';
      comment.read = ['staff', 'sysadmin'];
      break;
    default:
      break;
  }
  return comment;
};

exports.protectedOptions = (args, res) => {
  defaultLog.info('COMMENT PROTECTED OPTIONS');
  res.status(200).send();
};

exports.publicHead = async (args, res) => {
  defaultLog.info('COMMENT PUBLIC HEAD');
  // Build match query if on CommentPeriodId route
  let query = {};
  if (args.swagger.params.period && args.swagger.params.period.value) {
    query = Utils.buildQuery('period', args.swagger.params.period.value, query);
  }

  const fields = getSanitizedFields(args.swagger.params.fields.value);

  // Set query type
  _.assignIn(query, { _schemaName: 'Comment' });

  const data = await Utils.runDataQuery(
    'Comment',
    ['public'],
    false,
    query,
    fields, // Fields
    null, // sort warmup
    null, // sort
    null, // skip
    null, // limit
    true,
  ); // count
  Utils.recordAction('Head', 'CommentPeriod', 'public');
  // /api/comment/ route, return 200 OK with 0 items if necessary
  if (
    !(args.swagger.params.period && args.swagger.params.period.value) ||
    (data && data.length > 0)
  ) {
    res.setHeader(
      'x-total-count',
      data && data.length > 0 ? data[0].total_items : 0,
    );
    defaultLog.info('Got comment headers: ', data);
    return Actions.sendResponse(res, 200, data);
  } else {
    defaultLog.info('Could not retrieve comment headers.');
    return Actions.sendResponse(res, 404, data);
  }
};

exports.publicGet = async (args, res) => {
  defaultLog.info('COMMENT PUBLIC GET');
  let query = {},
    sort = {};
  let skip = null,
    limit = null;

  // Build match query if on commentId route.
  if (args.swagger.params.commentId && args.swagger.params.commentId.value) {
    query = Utils.buildQuery('_id', args.swagger.params.commentId.value, query);
  } else {
    if (args.swagger.params.period && args.swagger.params.period.value) {
      query = Utils.buildQuery(
        'period',
        args.swagger.params.period.value,
        query,
      );
    }
    // Sort
    if (args.swagger.params.sortBy && args.swagger.params.sortBy.value) {
      args.swagger.params.sortBy.value.forEach((value) => {
        const order_by = value.charAt(0) == '-' ? -1 : 1;
        const sort_by = value.slice(1);
        sort[sort_by] = order_by;
      }, this);
    }

    const processedParameters = Utils.getSkipLimitParameters(
      args.swagger.params.pageSize,
      args.swagger.params.pageNum,
    );
    skip = processedParameters.skip;
    limit = processedParameters.limit;
  }

  const fields = getSanitizedFields(args.swagger.params.fields.value);
  // Set query type
  _.assignIn(query, { _schemaName: 'Comment' });

  const data = await Utils.runDataQuery(
    'Comment',
    ['public'],
    false,
    query,
    fields, // Fields
    null,
    sort, // sort
    skip, // skip
    limit, // limit
    true,
  ); // count

  if (data[0] == null) {
    if (args.swagger.params.count.value) {
      res.setHeader('x-total-count', 0);
    }
    return Actions.sendResponse(res, 200, data);
  }

  _.each(data[0].results, (item) => {
    if (item.isAnonymous === true) {
      delete item.author;
    }
  });
  defaultLog.info('Got comment(s): ', data);
  if (args.swagger.params.count.value) {
    Utils.recordAction(
      'Get',
      'Comment',
      'public',
      args.swagger.params.commentId && args.swagger.params.commentId.value
        ? args.swagger.params.commentId.value
        : null,
    );
    res.setHeader(
      'x-total-count',
      data && data.length > 0 ? data[0].total_items : 0,
    );
    return Actions.sendResponse(
      res,
      200,
      data.length !== 0 ? data[0].results : [],
    );
  } else {
    return Actions.sendResponse(res, 200, data);
  }
};

exports.protectedHead = async (args, res) => {
  defaultLog.info('COMMENT PROTECTED HEAD');
  let query = {};

  if (args.swagger.params.commentId && args.swagger.params.commentId.value) {
    query = Utils.buildQuery('_id', args.swagger.params.commentId.value, query);
  }
  if (
    args.swagger.params._commentPeriod &&
    args.swagger.params._commentPeriod.value
  ) {
    query = Utils.buildQuery(
      '_commentPeriod',
      args.swagger.params._commentPeriod.value,
      query,
    );
  }
  // Unless they specifically ask for it, hide deleted results.
  if (
    args.swagger.params.isDeleted &&
    args.swagger.params.isDeleted.value != undefined
  ) {
    _.assignIn(query, { isDeleted: args.swagger.params.isDeleted.value });
  }
  // Set query type
  _.assignIn(query, { _schemaName: 'Comment' });

  const data = await Utils.runDataQuery(
    'Comment',
    args.swagger.operation['x-security-scopes'],
    args.swagger.params.auth_payload.idir_user_guid,
    query,
    ['_id', 'tags'], // Fields
    null, // sort warmup
    null, // sort
    null, // skip
    null, // limit
    true,
  ); // count
  Utils.recordAction(
    'Head',
    'Comment',
    args.swagger.params.auth_payload.preferred_username,
    args.swagger.params.commentId && args.swagger.params.commentId.value
      ? args.swagger.params.commentId.value
      : null,
  );
  // /api/comment/ route, return 200 OK with 0 items if necessary
  if (
    !(args.swagger.params.commentId && args.swagger.params.commentId.value) ||
    (data && data.length > 0)
  ) {
    res.setHeader(
      'x-total-count',
      data && data.length > 0 ? data[0].total_items : 0,
    );
    defaultLog.info('Got comment headers: ', data);
    return Actions.sendResponse(res, 200, data);
  } else {
    defaultLog.info('Could not retrieve comment headers.');
    return Actions.sendResponse(res, 404, data);
  }
};

exports.protectedGet = async (args, res) => {
  defaultLog.info('COMMENT PROTECTED GET');

  let query = {},
    sort = {},
    skip = null,
    limit = null,
    count = false,
    filter = [];

  // Build match query if on commentId route.
  if (args.swagger.params.commentId && args.swagger.params.commentId.value) {
    _.assignIn(query, {
      _id: mongoose.Types.ObjectId(args.swagger.params.commentId.value),
    });
  }

  // Build match query if on comment period's id
  if (args.swagger.params.period && args.swagger.params.period.value) {
    _.assignIn(query, {
      period: mongoose.Types.ObjectId(args.swagger.params.period.value),
    });
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
  const processedParameters = Utils.getSkipLimitParameters(
    args.swagger.params.pageSize,
    args.swagger.params.pageNum,
  );
  skip = processedParameters.skip;
  limit = processedParameters.limit;

  // Count
  if (args.swagger.params.count && args.swagger.params.count.value) {
    count = args.swagger.params.count.value;
  }

  // Set query type
  _.assignIn(query, { _schemaName: 'Comment' });

  // Set filter for eaoStatus
  if (
    args.swagger.params.pending &&
    args.swagger.params.pending.value === true
  ) {
    filter.push({ eaoStatus: 'Pending' });
  }
  if (
    args.swagger.params.published &&
    args.swagger.params.published.value === true
  ) {
    filter.push({ eaoStatus: 'Published' });
  }
  if (
    args.swagger.params.deferred &&
    args.swagger.params.deferred.value === true
  ) {
    filter.push({ eaoStatus: 'Deferred' });
  }
  if (
    args.swagger.params.rejected &&
    args.swagger.params.rejected.value === true
  ) {
    filter.push({ eaoStatus: 'Rejected' });
  }
  if (filter.length !== 0) {
    _.assignIn(query, { $or: filter });
  }

  let sanitizedFields = getSanitizedFields(args.swagger.params.fields.value);

  try {
    const data = await Utils.runDataQuery(
      'Comment',
      args.swagger.params.auth_payload.client_roles,
      args.swagger.params.auth_payload.idir_user_guid,
      query,
      sanitizedFields, // Fields
      null,
      sort, // sort
      skip, // skip
      limit, // limit
      count,
    ); // count
    Utils.recordAction(
      'Get',
      'Comment',
      args.swagger.params.auth_payload.preferred_username,
      args.swagger.params.commentId && args.swagger.params.commentId.value
        ? args.swagger.params.commentId.value
        : null,
    );
    defaultLog.info('Got comment(s):', data);

    // This is to get the next pending comment information.
    if (
      args.swagger.params.populateNextComment &&
      args.swagger.params.populateNextComment.value
    ) {
      defaultLog.info('Getting next pending comment information');
      let queryForNextComment = {};

      _.assignIn(queryForNextComment, { _id: { $ne: data[0]._id } });
      _.assignIn(queryForNextComment, { period: data[0].period });
      _.assignIn(queryForNextComment, { eaoStatus: 'Pending' });

      const nextComment = await Utils.runDataQuery(
        'Comment',
        args.swagger.params.auth_payload.client_roles,
        args.swagger.params.auth_payload.idir_user_guid,
        queryForNextComment,
        [], // Fields
        null,
        { commentId: 1 }, // sort
        0, // skip
        1, // limit
        true,
      ); // count
      res.setHeader(
        'x-pending-comment-count',
        nextComment && nextComment.length > 0 ? nextComment[0].total_items : 0,
      );
      res.setHeader(
        'x-next-comment-id',
        nextComment &&
          nextComment.length > 0 &&
          nextComment[0].results.length > 0
          ? nextComment[0].results[0]._id
          : null,
      );
    }
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    return Actions.sendResponse(res, 400, e, 'Comment protected get failed.');
  }
};

/**
 * A not oft used handler for adding comments from the backend. This may be removed
 * at some point. Unsure if it still works since it's used so little.
 *
 * @todo Remove or fix this handler.
 */
exports.protectedPost = async (args, res) => {
  defaultLog.info('COMMENT PROTECTED POST');
  const obj = args.swagger.params.comment.value;

  defaultLog.info('Incoming new comment:', obj);

  const Comment = mongoose.model('Comment');

  const vcs = [];
  obj.valuedComponents.forEach((vc) => {
    vcs.push(mongoose.Types.ObjectId(vc));
  });

  const docs = [];
  obj.documents.forEach((doc) => {
    docs.push(mongoose.Types.ObjectId(doc));
  });

  // get the next commentID for this period
  const commentIdCount = await getNextCommentIdCount(
    mongoose.Types.ObjectId(obj.period),
  );

  let comment = new Comment({
    _schemaName: 'Comment',
    author: obj.author,
    comment: obj.comment,
    dateAdded: obj.dateAdded,
    dateUpdated: obj.dateUpdated,
    documents: docs,
    eaoNotes: obj.eaoNotes,
    eaoStatus: obj.eaoStatus,
    isAnonymous: obj.isAnonymous,
    location: obj.location,
    period: mongoose.Types.ObjectId(obj.period),
    proponentNotes: obj.proponentNotes,
    proponentStatus: obj.proponentStatus,
    publishedNotes: obj.publishedNotes,
    rejectedNotes: obj.rejectedNotes,
    rejectedReason: obj.rejectedReason,
    valuedComponents: vcs,
    commentId: commentIdCount,
    write: ['staff', 'sysadmin'],
    delete: ['staff', 'sysadmin'],
  });

  comment = setPermissionsFromEaoStatus(obj.eaoStatus, comment);

  try {
    const c = await comment.save();
    Utils.recordAction(
      'Post',
      'Comment',
      args.swagger.params.auth_payload.preferred_username,
      c._id,
    );
    defaultLog.info('Saved new comment object:', c._id);
    return Actions.sendResponse(res, 200, c);
  } catch (e) {
    return Actions.sendResponse(res, 400, e, 'Comment protected post failed');
  }
};

async function getNextCommentIdCount(period) {
  const CommentPeriod = mongoose.model('CommentPeriod');
  const periodUpdate = await CommentPeriod.findOneAndUpdate(
    { _id: period },
    { $inc: { commentIdCount: 1 } },
    { new: true },
  );
  return periodUpdate.commentIdCount;
}

//  Create a new Comment
exports.unProtectedPost = async (args, res) => {
  defaultLog.info('COMMENT PUBLIC POST');
  const obj = args.swagger.params.comment.value;
  defaultLog.info('Incoming new object:', obj);

  const Comment = mongoose.model('Comment');

  // get the next commentID for this period
  const commentIdCount = await getNextCommentIdCount(
    mongoose.Types.ObjectId(obj.period),
  );

  let comment = new Comment({
    ...obj,
    _schemaName: 'Comment',
    eaoStatus: 'Pending',
    author: obj.author,
    comment: obj.comment,
    dateAdded: new Date(),
    dateUpdated: new Date(),
    isAnonymous: obj.isAnonymous,
    location: obj.location,
    period: mongoose.Types.ObjectId(obj.period),
    commentId: commentIdCount,
    documents: [],
    read: ['staff', 'sysadmin'],
    write: ['staff', 'sysadmin'],
    delete: ['staff', 'sysadmin'],
  });

  try {
    const c = await comment.save();
    Utils.recordAction('Post', 'Comment', 'public', c._id);
    defaultLog.info('Saved new comment object:', c._id);
    return Actions.sendResponse(res, 200, c);
  } catch (e) {
    return Actions.sendResponse(res, 400, e, 'Comment unprotected post failed');
  }
};

// Update an existing Comment
exports.protectedPut = async (args, res) => {
  defaultLog.info('COMMENT PROTECTED PUT');
  const objId = args.swagger.params.commentId.value;
  const obj = args.swagger.params.comment.value;
  defaultLog.info('Put comment:', objId);

  const Comment = mongoose.model('Comment');

  let comment = {
    isAnonymous: obj.isAnonymous,
    datePosted: obj.datePosted,
    dateUpdated: new Date(),
    eaoNotes: obj.eaoNotes,
    eaoStatus: obj.eaoStatus,
    proponentNotes: obj.proponentNotes,
    proponentStatus: obj.proponentStatus,
    publishedNotes: obj.publishedNotes,
    rejectedNotes: obj.rejectedNotes,
    rejectedReason: obj.rejectedReason,
  };
  comment = setPermissionsFromEaoStatus(obj.eaoStatus, comment);

  defaultLog.info('Incoming updated object:', comment);

  try {
    const c = await Comment.findByIdAndUpdate(
      objId,
      { $set: comment },
      { new: true },
    );
    Utils.recordAction(
      'Put',
      'Comment',
      args.swagger.params.auth_payload.preferred_username,
      objId,
    );
    defaultLog.info('Comment updated:', c._id);
    return Actions.sendResponse(res, 200, c);
  } catch (e) {
    return Actions.sendResponse(res, 500, e, 'Comment protected put failed');
  }
};

// Publish the Comment
exports.protectedStatus = async (args, res) => {
  defaultLog.info('COMMENT PROTECTED STATUS');
  const objId = args.swagger.params.commentId.value;
  const status = args.swagger.params.status.value.status;

  let comment = {
    dateUpdated: new Date(),
    updatedBy: args.swagger.params.auth_payload.preferred_username,
  };
  const Comment = mongoose.model('Comment');

  comment = setPermissionsFromEaoStatus(status, comment);

  try {
    const c = await Comment.findByIdAndUpdate(
      objId,
      { $set: comment },
      { new: true },
    );
    Utils.recordAction(
      'Status',
      'Comment',
      args.swagger.params.auth_payload.preferred_username,
      objId,
    );
    defaultLog.info('Comment updated:', c._id);
    return Actions.sendResponse(res, 200, c);
  } catch (e) {
    return Actions.sendResponse(res, 400, e, 'Comment protected status failed');
  }
};

// Export all comments
exports.protectedExport = async (args, res) => {
  defaultLog.info('COMMENT PROTECTED EXPORT');
  const period = args.swagger.params.periodId.value;
  const roles = args.swagger.params.auth_payload.client_roles;

  const match = {
    _schemaName: 'Comment',
    period: mongoose.Types.ObjectId(period),
  };

  const aggregation = [
    {
      $match: match,
    },
  ];

  aggregation.push({
    $redact: {
      $cond: {
        if: {
          // This way, if read isn't present, we assume public no roles array.
          $and: [
            { $cond: { if: '$read', then: true, else: false } },
            {
              $anyElementTrue: {
                $map: {
                  input: '$read',
                  as: 'fieldTag',
                  in: {
                    $setIsSubset: [['$$fieldTag'], roles],
                  },
                },
              },
            },
          ],
        },
        then: '$$KEEP',
        else: {
          $cond: { if: '$read', then: '$$PRUNE', else: '$$DESCEND' },
        },
      },
    },
  });

  const cursor = mongoose
    .model('Comment')
    .aggregate(aggregation)
    .allowDiskUse(true)
    .cursor({ batchSize: 1000 });

  const filename = 'export.csv';
  res.setHeader('Content-disposition', `attachment; filename=${filename}`);
  res.writeHead(200, { 'Content-Type': 'text/csv' });

  res.flushHeaders();

  cursor
    .pipe(
      transform((d) => {
        let read = d.read;
        delete d.userCan;
        delete d._schemaName;
        delete d.isPublished;
        delete d.delete;
        delete d.read;
        delete d.write;
        delete d.dateUpdated;
        delete d.dateAdded;
        delete d.resolvedBy;
        delete d.isResolved;
        delete d.isAnonymous;
        delete d.original;
        delete d.ancestor;
        delete d.parent;
        delete d.period;
        delete d.project;
        delete d.__v;
        delete d.updatedBy;
        delete d.datePosted;

        // todo: translate valuedComponents
        delete d.valuedComponents;

        // Translate documents into links.
        let docLinks = [];
        if (d.documents) {
          d.documents.forEach((theDoc) => {
            docLinks.push(
              'https://projects.eao.gov.bc.ca/api/document/' +
                theDoc +
                '/fetch',
            );
          });
        }

        delete d.documents;

        if (d.isAnonymous) {
          delete d.author;
          return {
            author: 'Anonymous',
            isPublished: read.includes('public'),
            documents: docLinks,
            ...d,
          };
        } else {
          return {
            isPublished: read.includes('public'),
            documents: docLinks,
            ...d,
          };
        }
      }),
    )
    .pipe(csv.stringify({ header: true }))
    .pipe(res);
};
