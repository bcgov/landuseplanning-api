var auth        = require("../helpers/auth");
var _           = require('lodash');
var defaultLog  = require('winston').loggers.get('default');
var mongoose    = require('mongoose');
var Actions     = require('../helpers/actions');
var Utils       = require('../helpers/utils');

var DEFAULT_PAGESIZE = 100;
var MAX_LIMIT = 1000;

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
};

exports.publicGet = function (args, res, next) {
  var query = {}, sort = {};
  var skip = null, limit = null;

  // Never return deleted comment(s).
  _.assignIn(query, { isDeleted: false });

  // Build match query if on CommentId route.
  if (args.swagger.params.CommentId && args.swagger.params.CommentId.value) {
    query = Utils.buildQuery("_id", args.swagger.params.CommentId.value, query);
  } else {
    if (args.swagger.params._commentPeriod && args.swagger.params._commentPeriod.value) {
      query = Utils.buildQuery("_commentPeriod", args.swagger.params._commentPeriod.value, query);
    }

    if (args.swagger.params.sortBy && args.swagger.params.sortBy.value) {
      args.swagger.params.sortBy.value.forEach(function (value) {
        var order_by = value.charAt(0) == '-' ? -1 : 1;
        var sort_by = value.slice(1);
        // only accept certain fields
        switch (sort_by) {
          case 'commentStatus':
          case 'dateAdded':
          case 'contactName':
            sort[sort_by] = order_by;
            break;
        }
      }, this);
    }

    var pageSize = DEFAULT_PAGESIZE;
    if (args.swagger.params.pageSize && args.swagger.params.pageSize.value !== undefined) {
      if (args.swagger.params.pageSize.value > 0) {
        pageSize = args.swagger.params.pageSize.value;
      }
    }
    if (args.swagger.params.pageNum && args.swagger.params.pageNum.value !== undefined) {
      if (args.swagger.params.pageNum.value >= 0) {
        skip = (args.swagger.params.pageNum.value * pageSize);
        limit = pageSize;
      }
    }
  }

  // defaultLog.info("query:", query);
  getComments(['public'], query, args.swagger.params.fields.value, sort, skip, limit)
  .then(function (data) {
    return Actions.sendResponse(res, 200, data);
  });
};

exports.protectedGet = function (args, res, next) {
  var query = {}, sort = {};
  var skip = null, limit = null;

  // Unless they specifically ask for it, don't return deleted comment(s).
  if (args.swagger.params.isDeleted && args.swagger.params.isDeleted.value === true) {
    _.assignIn(query, { isDeleted: true });
  } else {
    _.assignIn(query, { isDeleted: false });
  }

  // Build match query if on CommentId route.
  if (args.swagger.params.CommentId && args.swagger.params.CommentId.value) {
    query = Utils.buildQuery("_id", args.swagger.params.CommentId.value, query);
  } else {
    if (args.swagger.params._commentPeriod && args.swagger.params._commentPeriod.value) {
      query = Utils.buildQuery("_commentPeriod", args.swagger.params._commentPeriod.value, query);
    }

    if (args.swagger.params.sortBy && args.swagger.params.sortBy.value) {
      args.swagger.params.sortBy.value.forEach(function (value) {
        var order_by = value.charAt(0) == '-' ? -1 : 1;
        var sort_by = value.slice(1);
        // only accept certain fields
        switch (sort_by) {
          case 'commentStatus':
          case 'dateAdded':
          case 'contactName':
            sort[sort_by] = order_by;
            break;
          }
      }, this);
    }

    var pageSize = DEFAULT_PAGESIZE;
    if (args.swagger.params.pageSize && args.swagger.params.pageSize.value !== undefined) {
      if (args.swagger.params.pageSize.value > 0) {
        pageSize = args.swagger.params.pageSize.value;
      }
    }
    if (args.swagger.params.pageNum && args.swagger.params.pageNum.value !== undefined) {
      if (args.swagger.params.pageNum.value >= 0) {
        skip = (args.swagger.params.pageNum.value * pageSize);
        limit = pageSize;
      }
    }
  }

  // defaultLog.info("query:", query);
  getComments(args.swagger.operation["x-security-scopes"], query, args.swagger.params.fields.value, sort, skip, limit)
  .then(function (data) {
    return Actions.sendResponse(res, 200, data);
  });
};

//  Create a new Comment
exports.unProtectedPost = function (args, res, next) {
  var obj = args.swagger.params.comment.value;
  defaultLog.info("Incoming new object:", obj);

  var Comment = mongoose.model('Comment');
  var comment = new Comment(obj);

  comment.commentStatus = "Pending";
  comment.dateAdded = Date.now();

  // Define security tag defaults
  comment.tags = [['sysadmin']];
  comment.review.tags = [['sysadmin']];
  comment.commentAuthor.tags = [['sysadmin']];

  // Unless they request to be anon, make their stuff public.
  // TODO: Contact name/location/org currently showing public
  // when they request anonymous.
  if (!comment.commentAuthor.requestedAnonymous) {
    comment.commentAuthor.tags = [['sysadmin'], ['public']];
  }

  // Never allow this to be updated
  comment.commentAuthor.internal.tags = [['sysadmin']];

  // Not needed until we tie user profiles in.
  // comment._addedBy = args.swagger.params.auth_payload.preferred_username.value;

  comment.save()
  .then(function (c) {
    // defaultLog.info("Saved new Comment object:", c);
    return Actions.sendResponse(res, 200, c);
  });
};

// Update an existing Comment
exports.protectedPut = function (args, res, next) {
  var objId = args.swagger.params.CommentId.value;
  defaultLog.info("ObjectID:", args.swagger.params.CommentId.value);

  var obj = args.swagger.params.comment.value;

  // Strip security tags - these will not be updated on this route.
  delete obj.tags;
  if (obj.review) {
    delete obj.review.tags;
    if (obj.commentStatus === 'Accepted') {
      obj.review.tags = [['sysadmin'], ['public']]
    } else if (obj.commentStatus === 'Pending') {
      obj.review.tags = [['sysadmin']]
    } else if (obj.commentStatus === 'Rejected') {
      obj.review.tags = [['sysadmin']]
    }
  }

  if (obj.commentAuthor) {
    delete obj.commentAuthor.tags;
    // Did they request anon?
    if (obj.commentAuthor.requestedAnonymous) {
      obj.commentAuthor.tags = [['sysadmin']];
    } else {
      obj.commentAuthor.tags = [['sysadmin'], ['public']];
    }

    // Never allow this to be updated
    if (obj.commentAuthor.internal) {
      delete obj.commentAuthor.internal.tags;
      obj.commentAuthor.internal.tags = [['sysadmin']];
    }
  }

  defaultLog.info("Incoming updated object:", obj);
  // TODO sanitize/update audits.

  var Comment = require('mongoose').model('Comment');
  Comment.findOneAndUpdate({ _id: objId }, obj, { upsert: false, new: true }, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);
      return Actions.sendResponse(res, 200, o);
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
};

// Publish the Comment
exports.protectedPublish = function (args, res, next) {
  var objId = args.swagger.params.CommentId.value;
  defaultLog.info("Publish Comment:", objId);

  var Comment = require('mongoose').model('Comment');
  Comment.findOne({ _id: objId }, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);

      // Add public to the tag of this obj.
      Actions.publish(o)
      .then(function (published) {
        // Published successfully
        return Actions.sendResponse(res, 200, published);
      }, function (err) {
        // Error
        return Actions.sendResponse(res, err.code, err);
      });
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
};

// Unpublish the Comment
exports.protectedUnPublish = function (args, res, next) {
  var objId = args.swagger.params.CommentId.value;
  defaultLog.info("UnPublish Comment:", objId);

  var Comment = require('mongoose').model('Comment');
  Comment.findOne({ _id: objId }, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);

      // Remove public to the tag of this obj.
      Actions.unPublish(o)
      .then(function (unpublished) {
        // UnPublished successfully
        return Actions.sendResponse(res, 200, unpublished);
      }, function (err) {
        // Error
        return Actions.sendResponse(res, err.code, err);
      });
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
};

var getComments = function (role, query, fields, sort, skip, limit) {
  return new Promise(function (resolve, reject) {
    var Comment = mongoose.model('Comment');
    var projection = {};

    // Fields we always return
    var defaultFields = ['_id',
                        'tags'];
    _.each(defaultFields, function (f) {
        projection[f] = 1;
    });

    // Add requested fields - sanitize first by including only those that we can/want to return
    var sanitizedFields = _.remove(fields, function (f) {
      return (_.indexOf(['name',
                        'commentNumber',
                        'comment',
                        'internal',
                        'dateAdded',
                        'commentAuthor',
                        'review',
                        '_addedBy',
                        '_commentPeriod',
                        'review',
                        'commentStatus',
                        'isDeleted'], f) !== -1);
    });
    _.each(sanitizedFields, function (f) {
      projection[f] = 1;
    });

    // use compact() to remove null elements
    var aggregations = _.compact([
      { $match: query },
      { $project: projection },
      { $redact: {
         $cond: {
            if: {
              $anyElementTrue: {
                    $map: {
                      input: "$tags" ,
                      as: "fieldTag",
                      in: { $setIsSubset: [ "$$fieldTag", role ] }
                    }
                  }
                },
              then: "$$DESCEND",
              else: "$$PRUNE"
            }
          }
      },
      // extract 'contactName' and lower-case it so we can sort on it
      sort && sort.contactName ? { $project: Object.assign({ contactName: { $toLower: "$commentAuthor.contactName" } }, projection) } : null,
      !_.isEmpty(sort) ? { $sort: sort } : null,
      // project with original keys to exclude 'contactName'
      sort && sort.contactName ? { $project: projection } : null,
      { $skip: skip || 0 },
      { $limit: limit || MAX_LIMIT }
    ]);

    Comment.aggregate(aggregations).exec()
    .then(function (data) {
      defaultLog.info("data:", data);
      resolve(data);
    });
  });
};
