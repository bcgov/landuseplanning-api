var auth        = require("../helpers/auth");
var _           = require('lodash');
var defaultLog  = require('winston').loggers.get('default');
var mongoose    = require('mongoose');
var mime        = require('mime-types');
var Actions     = require('../helpers/actions');
var Utils       = require('../helpers/utils');
var FlakeIdGen  = require('flake-idgen'),
    intformat   = require('biguint-format'),
    generator   = new FlakeIdGen;
var fs          = require('fs');
var uploadDir   = process.env.UPLOAD_DIRECTORY || "./uploads/";
var ENABLE_VIRUS_SCANNING = process.env.ENABLE_VIRUS_SCANNING || false;

var getSanitizedFields = function (fields) {
  return _.remove(fields, function (f) {
    return (_.indexOf(['displayName',
                      '_addedBy',
                      'documentFileName',
                      'internalOriginalName',
                      'displayName',
                      'documentType',
                      'datePosted',
                      'dateUploaded',
                      'dateReceived',
                      'documentFileSize',
                      'internalURL',
                      'internalMime',
                      'checkbox',
                      'project',
                      'type',
                      'documentAuthor',
                      'milestone',
                      'description',
                      'isPublished',
                      'internalMime'], f) !== -1);
  });
}

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

exports.publicGet = function (args, res, next) {
  // Build match query if on docId route
  var query = {};
  if (args.swagger.params.docId) {
    query = Utils.buildQuery("_id", args.swagger.params.docId.value, query);
  }
  if (args.swagger.params._application && args.swagger.params._application.value) {
    query = Utils.buildQuery("_application", args.swagger.params._application.value, query);
  }
  if (args.swagger.params._comment && args.swagger.params._comment.value) {
    query = Utils.buildQuery("_comment", args.swagger.params._comment.value, query);
  }

  // Set query type
  _.assignIn(query, {"_schemaName": "Document"});

  Utils.runDataQuery('Document',
                    ['public'],
                    query,
                    getSanitizedFields(args.swagger.params.fields.value), // Fields
                    null, // sort warmup
                    null, // sort
                    null, // skip
                    null, // limit
                    false) // count
  .then(function (data) {
    return Actions.sendResponse(res, 200, data);
  });
};
exports.unProtectedPost = function(args, res, next) {
  console.log("Creating new object");
  var _application  = args.swagger.params._application.value;
  var _comment      = args.swagger.params._comment.value;
  var displayName   = args.swagger.params.displayName.value;
  var upfile        = args.swagger.params.upfile.value;

  var guid = intformat(generator.next(), 'dec');
  var ext = mime.extension(args.swagger.params.upfile.value.mimetype);
  try {
    Promise.resolve()
    .then(function () {
      if (ENABLE_VIRUS_SCANNING == 'true') {
        return Utils.avScan(args.swagger.params.upfile.value.buffer);
      } else {
        return true;
      }
    })
    .then(function (valid) {
      if (!valid) {
        defaultLog.warn("File failed virus check.");
        return Actions.sendResponse(res, 400, {"message" : "File failed virus check."});
      } else {
        fs.writeFileSync(uploadDir+guid+"."+ext, args.swagger.params.upfile.value.buffer);
        var Document = mongoose.model('Document');
        var doc = new Document();
        // Define security tag defaults
        doc.tags = [['sysadmin']];
        doc._application = _application;
        doc._comment = _comment;
        doc.displayName = displayName;
        doc.documentFileName = upfile.originalname;
        doc.internalMime = upfile.mimetype;
        doc.internalURL = uploadDir+guid+"."+ext;
        doc.passedAVCheck = true;
        // Update who did this?  TODO: Public
        // doc._addedBy = args.swagger.params.auth_payload.preferred_username;
        doc.save()
        .then(function (d) {
          defaultLog.info("Saved new document object:", d._id);
          return Actions.sendResponse(res, 200, d);
        });
      }
    });
  } catch (e) {
    defaultLog.info("Error:", e);
    // Delete the path details before we return to the caller.
    delete e['path'];
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedHead = function (args, res, next) {
  var Document = mongoose.model('Document');

  defaultLog.info("args.swagger.params:", args.swagger.params.auth_payload.realm_access.roles);

  // Build match query if on docId route
  var query = {};
  if (args.swagger.params.docId) {
    query = Utils.buildQuery("_id", args.swagger.params.docId.value, query);
  }
  if (args.swagger.params._application && args.swagger.params._application.value) {
    query = Utils.buildQuery("_application", args.swagger.params._application.value, query);
  }
  if (args.swagger.params._comment && args.swagger.params._comment.value) {
    query = Utils.buildQuery("_comment", args.swagger.params._comment.value, query);
  }
  // Unless they specifically ask for it, hide deleted results.
  if (args.swagger.params.isDeleted && args.swagger.params.isDeleted.value != undefined) {
    _.assignIn(query, { isDeleted: args.swagger.params.isDeleted.value });
  } else {
    
  }
  // Set query type
  _.assignIn(query, {"_schemaName": "Document"});

  Utils.runDataQuery('Document',
                    args.swagger.params.auth_payload.realm_access.roles,
                    query,
                    ['_id',
                      'tags'], // Fields
                    null, // sort warmup
                    null, // sort
                    null, // skip
                    null, // limit
                    true) // count
  .then(function (data) {
    // /api/commentperiod/ route, return 200 OK with 0 items if necessary
    if (!(args.swagger.params.docId && args.swagger.params.docId.value) || (data && data.length > 0)) {
      res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items: 0);
      return Actions.sendResponse(res, 200, data);
    } else {
      return Actions.sendResponse(res, 404, data);
    }
  });
}

exports.protectedGet = function(args, res, next) {
  var self        = this;
  self.scopes     = args.swagger.params.auth_payload.realm_access.roles;

  var Document = mongoose.model('Document');

  defaultLog.info("args.swagger.params:", args.swagger.params.auth_payload.realm_access.roles);

  // Build match query if on docId route
  var query = {};
  if (args.swagger.params.docId) {
    // query = Utils.buildQuery("_id", args.swagger.params.docId.value, query);
    _.assignIn(query, { _id: mongoose.Types.ObjectId(args.swagger.params.docId.value)});
  }
  if (args.swagger.params._application && args.swagger.params._application.value) {
    query = Utils.buildQuery("_application", args.swagger.params._application.value, query);
  }
  if (args.swagger.params._comment && args.swagger.params._comment.value) {
    query = Utils.buildQuery("_comment", args.swagger.params._comment.value, query);
  }
  // Unless they specifically ask for it, hide deleted results.
  // if (args.swagger.params.isDeleted && args.swagger.params.isDeleted.value != undefined) {
  //   _.assignIn(query, { isDeleted: args.swagger.params.isDeleted.value });
  // } else {
  //   _.assignIn(query, { isDeleted: { $exists: true, $ne: true } });
  // }

  // Set query type
  _.assignIn(query, {"_schemaName": "Document"});
  console.log("QUERY:", query);

  Utils.runDataQuery('Document',
                    args.swagger.params.auth_payload.realm_access.roles,
                    query,
                    getSanitizedFields(args.swagger.params.fields.value), // Fields
                    null, // sort warmup
                    null, // sort
                    null, // skip
                    null, // limit
                    false) // count
  .then(function (data) {
    console.log("DATA:", data);
    return Actions.sendResponse(res, 200, data);
  });
};
exports.publicDownload = function(args, res, next) {
  var self        = this;
  var Document = mongoose.model('Document');

  // Build match query if on docId route
  var query = {};
  if (args.swagger.params.docId) {
    query = Utils.buildQuery("_id", args.swagger.params.docId.value, query);
  } else {
    return Actions.sendResponse(res, 404, {});
  }
  // Set query type
  _.assignIn(query, {"_schemaName": "Document"});

  Utils.runDataQuery('Document',
                    ['public'],
                    query,
                    ["internalURL", "documentFileName", "internalMime"], // Fields
                    null, // sort warmup
                    null, // sort
                    null, // skip
                    null, // limit
                    false) // count
  .then(function (data) {
    if (data && data.length === 1) {
      var blob = data[0];
      if (fs.existsSync(blob.internalURL)) {
        var stream 	= fs.createReadStream(blob.internalURL);
        var stat 	= fs.statSync(blob.internalURL);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Type', blob.internalMime);
        res.setHeader('Content-Disposition', 'inline;filename="' + blob.documentFileName + '"');
        stream.pipe(res);
			}
    } else {
      return Actions.sendResponse(res, 404, {});
    }
  });
};

exports.protectedDownload = function(args, res, next) {
  var self        = this;
  self.scopes     = args.swagger.params.auth_payload.realm_access.roles;

  var Document = mongoose.model('Document');

  defaultLog.info("args.swagger.params:", args.swagger.params.auth_payload.realm_access.roles);

  // Build match query if on docId route
  var query = {};
  if (args.swagger.params.docId) {
    query = Utils.buildQuery("_id", args.swagger.params.docId.value, query);
  }
  // Set query type
  _.assignIn(query, {"_schemaName": "Document"});

  Utils.runDataQuery('Document',
                    args.swagger.params.auth_payload.realm_access.roles,
                    query,
                    ["internalURL", "documentFileName", "internalMime"], // Fields
                    null, // sort warmup
                    null, // sort
                    null, // skip
                    null, // limit
                    false) // count
  .then(function (data) {
    console.log("data:", data);
    if (data && data.length === 1) {
      var blob = data[0];
      if (fs.existsSync(blob.internalURL)) {
        var stream 	= fs.createReadStream(blob.internalURL);
        var stat 	= fs.statSync(blob.internalURL);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Type', blob.internalMime);
        res.setHeader('Content-Disposition', 'inline;filename="' + blob.documentFileName + '"');
        stream.pipe(res);
			}
    } else {
      return Actions.sendResponse(res, 404, {});
    }
  });
};

//  Create a new document
exports.protectedPost = function (args, res, next) {
  console.log("Creating new protected document object");
  var project  = args.swagger.params.project.value;
  var _comment      = args.swagger.params._comment.value;
  var upfile        = args.swagger.params.upfile.value;
  var guid = intformat(generator.next(), 'dec');
  var ext = mime.extension(args.swagger.params.upfile.value.mimetype);
  try {
    Promise.resolve()
    .then(function () {
      if (ENABLE_VIRUS_SCANNING == 'true') {
        return Utils.avScan(args.swagger.params.upfile.value.buffer);
      } else {
        return true;
      }
    })
    .then(function (valid) {
      if (!valid) {
        defaultLog.warn("File failed virus check.");
        return Actions.sendResponse(res, 400, {"message" : "File failed virus check."});
      } else {
        fs.writeFileSync(uploadDir+guid+"."+ext, args.swagger.params.upfile.value.buffer);

        var Document = mongoose.model('Document');
        var doc = new Document();
        // Define security tag defaults
        doc.project = mongoose.Types.ObjectId(project);
        doc._comment = _comment;
        doc._addedBy = args.swagger.params.auth_payload.preferred_username;
        doc._createdDate = new Date();
        doc.read = [['sysadmin'], ['project-system-admin'], ['staff']];
        doc.write = [['sysadmin'], ['project-system-admin'], ['staff']];
        doc.delete = [['sysadmin'], ['project-system-admin'], ['staff']];

        doc.documentFileName = args.swagger.params.documentFileName.value;
        doc.internalURL = uploadDir+guid+"."+ext;
        doc.internalSize = "0";  // TODO
        doc.passedAVCheck = true;
        doc.internalMime = upfile.mimetype;

        doc.documentSource = args.swagger.params.documentSource.value;

        // TODO Not Yet
        // doc.labels = JSON.parse(args.swagger.params.labels.value);

        doc.displayName = args.swagger.params.displayName.value;
        doc.milestone = args.swagger.params.milestone.value;
        doc.dateUploaded = args.swagger.params.dateUploaded.value;
        doc.datePosted = args.swagger.params.datePosted.value;
        doc.type = args.swagger.params.type.value;
        doc.description = args.swagger.params.description.value;
        doc.documentAuthor = args.swagger.params.documentAuthor.value;
        // Update who did this?
        doc.save()
        .then(function (d) {
          defaultLog.info("Saved new document object:", d._id);
          return Actions.sendResponse(res, 200, d);
        });
      }
    });
  } catch (e) {
    defaultLog.info("Error:", e);
    // Delete the path details before we return to the caller.
    delete e['path'];
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedPublish = function (args, res, next) {
  var objId = args.swagger.params.docId.value;
  defaultLog.info("Publish Document:", objId);

  var Document = require('mongoose').model('Document');
  Document.findOne({_id: objId}, function (err, o) {
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
exports.protectedUnPublish = function (args, res, next) {
  var objId = args.swagger.params.docId.value;
  defaultLog.info("UnPublish Document:", objId);

  var Document = require('mongoose').model('Document');
  Document.findOne({_id: objId}, function (err, o) {
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

// Update an existing document
exports.protectedPut = function (args, res, next) {
  console.log("args:", args.swagger.params);
  // defaultLog.info("upfile:", args.swagger.params.upfile);
  var objId = args.swagger.params.docId.value;

  var obj = {};

  obj._updatedBy = args.swagger.params.auth_payload.preferred_username;

  obj.displayName = args.swagger.params.displayName.value;
  obj.milestone = args.swagger.params.milestone.value;
  obj.dateUploaded = args.swagger.params.dateUploaded.value;
  obj.datePosted = args.swagger.params.datePosted.value;
  obj.type = args.swagger.params.type.value;
  obj.description = args.swagger.params.description.value;
  obj.documentAuthor = args.swagger.params.documentAuthor.value;

  // TODO Not Yet
  // obj.labels = JSON.parse(args.swagger.params.labels.value);

  defaultLog.info("ObjectID:", objId);

  // Update who did this?

  var Document = mongoose.model('Document');
  Document.findOneAndUpdate({_id: objId}, obj, {upsert:false}, function (err, o) {
    if (o) {
      // defaultLog.info("o:", o);
      return Actions.sendResponse(res, 200, o);
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
}

//  Delete a Document
exports.protectedDelete = async function (args, res, next) {
  var objId = args.swagger.params.docId.value;
  defaultLog.info("Delete Document:", objId);

  var Document = require('mongoose').model('Document');
  try {
    var doc = await Document.findOneAndRemove({_id: objId});
    Utils.recordAction('delete', 'document', args.swagger.params.auth_payload.preferred_username, objId);
    return Actions.sendResponse(res, 200, {});
  } catch (e) {
    console.log("Error:", e);
    return Actions.sendResponse(res, 400, e);
  }
};