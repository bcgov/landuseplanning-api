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
                      'internalURL',
                      'passedAVCheck',
                      'documentFileName',
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

  defaultLog.info("args.swagger.params:", args.swagger.operation["x-security-scopes"]);

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
                    args.swagger.operation["x-security-scopes"],
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
  self.scopes     = args.swagger.operation["x-security-scopes"];

  var Document = mongoose.model('Document');

  defaultLog.info("args.swagger.params:", args.swagger.operation["x-security-scopes"]);

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
    _.assignIn(query, { isDeleted: { $exists: true, $ne: true } });
  }

  console.log("QUERY:", query);
  // Set query type
  _.assignIn(query, {"_schemaName": "Document"});

  Utils.runDataQuery('Document',
                    args.swagger.operation["x-security-scopes"],
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
  self.scopes     = args.swagger.operation["x-security-scopes"];

  var Document = mongoose.model('Document');

  defaultLog.info("args.swagger.params:", args.swagger.operation["x-security-scopes"]);

  // Build match query if on docId route
  var query = {};
  if (args.swagger.params.docId) {
    query = Utils.buildQuery("_id", args.swagger.params.docId.value, query);
  }
  // Set query type
  _.assignIn(query, {"_schemaName": "Document"});

  Utils.runDataQuery('Document',
                    args.swagger.operation["x-security-scopes"],
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

//  Create a new document
exports.protectedPost = function (args, res, next) {
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
        // Update who did this?
        doc._addedBy = args.swagger.params.auth_payload.preferred_username;
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

exports.protectedDelete = function (args, res, next) {
  var objId = args.swagger.params.docId.value;
  defaultLog.info("Delete Document:", objId);

  var Document = require('mongoose').model('Document');
  Document.findOne({_id: objId, isDeleted: false}, function (err, o) {
    if (o) {
      defaultLog.info("o:", o);

      // Set the deleted flag.
      Actions.delete(o)
      .then(function (deleted) {
        // Deleted successfully
        return Actions.sendResponse(res, 200, deleted);
      }, function (err) {
        // Error
        return Actions.sendResponse(res, 400, err);
      });
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
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
  // defaultLog.info("upfile:", args.swagger.params.upfile);
  var objId = args.swagger.params.docId.value;
  var _application  = args.swagger.params._application.value;
  var _comment      = args.swagger.params._comment.value;
  defaultLog.info("ObjectID:", args.swagger.params.docId.value);

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
        var obj = args.swagger.params;
        // Strip security tags - these will not be updated on this route.
        delete obj.tags;
        defaultLog.info("Incoming updated object:", obj._id);
        // Update file location
        obj.internalURL = uploadDir+guid+"."+ext;
        // Update who did this?
        obj._addedBy = args.swagger.params.auth_payload.preferred_username;
        doc._application = _application;
        doc._comment = _comment;
        doc.displayName = displayName;
        doc.passedAVCheck = true;
        var Document = mongoose.model('Document');
        Document.findOneAndUpdate({_id: objId}, obj, {upsert:false, new: true}, function (err, o) {
          if (o) {
            // defaultLog.info("o:", o);
            return Actions.sendResponse(res, 200, o);
          } else {
            defaultLog.info("Couldn't find that object!");
            return Actions.sendResponse(res, 404, {});
          }
        });
      }
    });
  } catch (e) {
    defaultLog.info("Error:", e);
    // Delete the path details before we return to the caller.
    delete e['path'];
    return Actions.sendResponse(res, 400, e);
  }
}

//  Delete a Document
exports.protectedDelete = async function (args, res, next) {
  var objId = args.swagger.params.docId.value;
  defaultLog.info("Delete Document:", objId);

  var document = mongoose.model('Document');
  document.findOne({ _id: objId }, async function (err, o) {
    if (o) {
      defaultLog.info("o:", o);

      // Set the deleted flag.
      var deleted = await Actions.delete(o)
      // Deleted successfully
      return Actions.sendResponse(res, 200, deleted);
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  });
};
