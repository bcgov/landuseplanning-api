var auth = require("../helpers/auth");
var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var mime = require('mime-types');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');
var FlakeIdGen = require('flake-idgen'),
  intformat = require('biguint-format'),
  generator = new FlakeIdGen;
var fs = require('fs');
var uploadDir = process.env.UPLOAD_DIRECTORY || "./uploads/";
var ENABLE_VIRUS_SCANNING = process.env.ENABLE_VIRUS_SCANNING || false;
var MinioController = require('../helpers/minio');
var rp = require('request-promise-native');

var getSanitizedFields = function (fields) {
  return _.remove(fields, function (f) {
    return (_.indexOf(['displayName',
      '_addedBy',
      'documentFileName',
      'internalExt',
      'internalOriginalName',
      'displayName',
      'labels',
      'documentType',
      'datePosted',
      'dateUploaded',
      'dateReceived',
      'documentFileSize',
      'documentSource',
      'eaoStatus',
      'internalURL',
      'internalMime',
      'internalSize',
      'checkbox',
      'project',
      'type',
      'documentAuthor',
      'documentAuthorType',
      'milestone',
      'projectPhase',
      'description',
      'keywords',
      'isPublished',
      'internalMime'], f) !== -1);
  });
}

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

exports.publicGet = async function (args, res, next) {
  // Build match query if on docId route
  var query = {};
  if (args.swagger.params.docId && args.swagger.params.docId.value) {
    query = Utils.buildQuery("_id", args.swagger.params.docId.value, query);
  } else if (args.swagger.params.docIds && args.swagger.params.docIds.value && args.swagger.params.docIds.value.length > 0) {
    query = Utils.buildQuery("_id", args.swagger.params.docIds.value);
  }
  if (args.swagger.params.project && args.swagger.params.project.value) {
    query = Utils.buildQuery("project", args.swagger.params.project.value, query);
  }

  // Set query type
  _.assignIn(query, { "_schemaName": "Document" });

  try {
    var data = await Utils.runDataQuery('Document',
      ['public'],
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null, // sort warmup
      null, // sort
      null, // skip
      null, // limit
      false); // count
    defaultLog.info('Got document(s):', data);
    Utils.recordAction('Get', 'Document', 'public', args.swagger.params.docId && args.swagger.params.docId.value ? args.swagger.params.docId.value : null);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.unProtectedPost = async function (args, res, next) {
  console.log("Creating new object");
  var _comment = args.swagger.params._comment.value;
  var project = args.swagger.params.project.value;
  var upfile = args.swagger.params.upfile.value;
  var guid = intformat(generator.next(), 'dec');
  var ext = mime.extension(args.swagger.params.upfile.value.mimetype);
  var tempFilePath = uploadDir + guid + "." + ext;
  try {
    Promise.resolve()
      .then(async function () {
        if (ENABLE_VIRUS_SCANNING == 'true') {
          return Utils.avScan(args.swagger.params.upfile.value.buffer);
        } else {
          return true;
        }
      })
      .then(async function (valid) {
        if (!valid) {
          defaultLog.warn("File failed virus check.");
          return Actions.sendResponse(res, 400, { "message": "File failed virus check." });
        } else {
          console.log('writing file.');
          fs.writeFileSync(tempFilePath, args.swagger.params.upfile.value.buffer);
          console.log('wrote file successfully.');

          console.log(MinioController.BUCKETS.DOCUMENTS_BUCKET,
            mongoose.Types.ObjectId(project),
            upfile.originalname,
            tempFilePath);

          MinioController.putDocument(MinioController.BUCKETS.DOCUMENTS_BUCKET,
            project,
            upfile.originalname,
            tempFilePath)
            .then(async function (minioFile) {
              console.log("putDocument:", minioFile);

              // remove file from temp folder
              fs.unlinkSync(tempFilePath);

              console.log('unlink');

              var Document = mongoose.model('Document');
              var doc = new Document();
              // Define security tag defaults
              doc.project = mongoose.Types.ObjectId(project);
              doc._comment = _comment;
              doc._addedBy = 'public';
              doc._createdDate = new Date();
              doc.read = ['sysadmin', 'staff'];
              doc.write = ['sysadmin', 'staff'];
              doc.delete = ['sysadmin', 'staff'];

              doc.internalOriginalName = upfile.originalname;
              doc.internalURL = minioFile.path;
              doc.internalExt = minioFile.extension;
              doc.internalSize = upfile.size;
              doc.passedAVCheck = true;
              doc.internalMime = upfile.mimetype;

              doc.documentSource = "COMMENT";

              doc.displayName = upfile.originalname;
              doc.documentFileName = upfile.originalname;
              doc.dateUploaded = new Date();
              doc.datePosted = new Date();
              doc.documentAuthor = args.body.documentAuthor;
              doc.documentAuthorType = mongoose.Types.ObjectId(args.body.documentAuthorType);

              doc.save()
                .then(async function (d) {
                  defaultLog.info("Saved new document object:", d._id);

                  var Comment = mongoose.model('Comment');
                  var c = await Comment.update({ _id: _comment }, { $addToSet: { documents: d._id } });
                  defaultLog.info('Comment updated:', c);
                  Utils.recordAction('Post', 'Document', 'public', d._id);
                  return Actions.sendResponse(res, 200, d);
                })
                .catch(async function (error) {
                  console.log("error:", error);
                  // the model failed to be created - delete the document from minio so the database and minio remain in sync.
                  MinioController.deleteDocument(MinioController.BUCKETS.DOCUMENTS_BUCKET, doc.project, doc.internalURL);
                  return Actions.sendResponse(res, 400, error);
                });
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
  if (args.swagger.params.docId && args.swagger.params.docId.value) {
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
  _.assignIn(query, { "_schemaName": "Document" });

  Utils.runDataQuery('Document',
    args.swagger.params.auth_payload.realm_access.roles,
    query,
    ['_id',
      'read'], // Fields
    null, // sort warmup
    null, // sort
    null, // skip
    null, // limit
    true) // count
    .then(function (data) {
      Utils.recordAction('Head', 'Document', args.swagger.params.auth_payload.preferred_username, args.swagger.params.docId && args.swagger.params.docId.value ? args.swagger.params.docId.value : null);
      // /api/commentperiod/ route, return 200 OK with 0 items if necessary
      if (!(args.swagger.params.docId && args.swagger.params.docId.value) || (data && data.length > 0)) {
        res.setHeader('x-total-count', data && data.length > 0 ? data[0].total_items : 0);
        return Actions.sendResponse(res, 200, data);
      } else {
        return Actions.sendResponse(res, 404, data);
      }
    });
}

exports.protectedGet = async function (args, res, next) {
  defaultLog.info('Getting document(s)');

  var query = {}, sort = {}, skip = null, limit = null, count = false;

  // Build match query if on docId route
  if (args.swagger.params.docId && args.swagger.params.docId.value) {
    _.assignIn(query, { _id: mongoose.Types.ObjectId(args.swagger.params.docId.value) });
  } else if (args.swagger.params.docIds && args.swagger.params.docIds.value && args.swagger.params.docIds.value.length > 0) {
    query = Utils.buildQuery("_id", args.swagger.params.docIds.value);
  }

  if (args.swagger.params.project && args.swagger.params.project.value) {
    query = Utils.buildQuery("project", args.swagger.params.project.value, query);
  }

  // Set query type
  _.assignIn(query, { "_schemaName": "Document" });

  try {
    var data = await Utils.runDataQuery('Document',
      args.swagger.params.auth_payload.realm_access.roles,
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null, // sort warmup
      sort, // sort
      skip, // skip
      limit, // limit
      count); // count
    Utils.recordAction('Get', 'Document', args.swagger.params.auth_payload.preferred_username, args.swagger.params.docId && args.swagger.params.docId.value ? args.swagger.params.docId.value : null);
    defaultLog.info('Got document(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.publicDownload = function (args, res, next) {
  var self = this;
  var Document = mongoose.model('Document');

  // Build match query if on docId route
  var query = {};
  if (args.swagger.params.docId && args.swagger.params.docId.value) {
    query = Utils.buildQuery("_id", args.swagger.params.docId.value, query);
  } else {
    return Actions.sendResponse(res, 404, {});
  }
  // Set query type
  _.assignIn(query, { "_schemaName": "Document" });

  Utils.runDataQuery('Document',
    ['public'],
    query,
    ["internalURL", "documentFileName", "internalMime", 'internalExt'], // Fields
    null, // sort warmup
    null, // sort
    null, // skip
    null, // limit
    false) // count
    .then(function (data) {
      if (data && data.length === 1) {
        var blob = data[0];

        var fileName = blob.documentFileName;
        var fileType = blob.internalExt;
        if (fileName.slice(- fileType.length) !== fileType) {
          fileName = fileName + '.' + fileType;
        }
        var fileMeta;

        // check if the file exists in Minio
        return MinioController.statObject(MinioController.BUCKETS.DOCUMENTS_BUCKET, blob.internalURL)
          .then(function (objectMeta) {
            fileMeta = objectMeta;
            // get the download URL
            return MinioController.getPresignedGETUrl(MinioController.BUCKETS.DOCUMENTS_BUCKET, blob.internalURL);
          }, function () {
            return Actions.sendResponse(res, 404, {});
          })
          .then(function (docURL) {
            Utils.recordAction('Download', 'Document', 'public', args.swagger.params.docId && args.swagger.params.docId.value ? args.swagger.params.docId.value : null);
            // stream file from Minio to client
            res.setHeader('Content-Length', fileMeta.size);
            res.setHeader('Content-Type', fileMeta.metaData['content-type']);
            res.setHeader('Content-Disposition', 'attachment;filename="' + fileName + '"');
            return rp(docURL).pipe(res);
          });
      } else {
        return Actions.sendResponse(res, 404, {});
      }
    });
};

exports.protectedDownload = function (args, res, next) {
  var self = this;
  self.scopes = args.swagger.params.auth_payload.realm_access.roles;

  var Document = mongoose.model('Document');

  defaultLog.info("args.swagger.params:", args.swagger.params.auth_payload.realm_access.roles);

  // Build match query if on docId route
  var query = {};
  if (args.swagger.params.docId && args.swagger.params.docId.value) {
    query = Utils.buildQuery("_id", args.swagger.params.docId.value, query);
  }
  // Set query type
  _.assignIn(query, { "_schemaName": "Document" });

  Utils.runDataQuery('Document',
    args.swagger.params.auth_payload.realm_access.roles,
    query,
    ["internalURL", "documentFileName", "internalMime", 'internalExt'], // Fields
    null, // sort warmup
    null, // sort
    null, // skip
    null, // limit
    false) // count
    .then(function (data) {
      if (data && data.length === 1) {
        var blob = data[0];

        var fileName = blob.documentFileName;
        var fileType = blob.internalExt;
        if (fileName.slice(- fileType.length) !== fileType) {
          fileName = fileName + '.' + fileType;
        }
        var fileMeta;

        // check if the file exists in Minio
        return MinioController.statObject(MinioController.BUCKETS.DOCUMENTS_BUCKET, blob.internalURL)
          .then(function (objectMeta) {
            fileMeta = objectMeta;
            // get the download URL
            return MinioController.getPresignedGETUrl(MinioController.BUCKETS.DOCUMENTS_BUCKET, blob.internalURL);
          }, function () {
            return Actions.sendResponse(res, 404, {});
          })
          .then(function (docURL) {
            Utils.recordAction('Download', 'Document', args.swagger.params.auth_payload.preferred_username, args.swagger.params.docId && args.swagger.params.docId.value ? args.swagger.params.docId.value : null);
            // stream file from Minio to client
            res.setHeader('Content-Length', fileMeta.size);
            res.setHeader('Content-Type', fileMeta.metaData['content-type']);
            res.setHeader('Content-Disposition', 'attachment;filename="' + fileName + '"');
            return rp(docURL).pipe(res);
          });
      } else {
        return Actions.sendResponse(res, 404, {});
      }
    });
};

exports.protectedOpen = function (args, res, next) {
  var self = this;
  self.scopes = args.swagger.params.auth_payload.realm_access.roles;

  var Document = mongoose.model('Document');

  defaultLog.info("args.swagger.params:", args.swagger.params.auth_payload.realm_access.roles);

  // Build match query if on docId route
  var query = {};
  if (args.swagger.params.docId && args.swagger.params.docId.value) {
    query = Utils.buildQuery("_id", args.swagger.params.docId.value, query);
  }
  // Set query type
  _.assignIn(query, { "_schemaName": "Document" });

  Utils.runDataQuery('Document',
    args.swagger.params.auth_payload.realm_access.roles,
    query,
    ["internalURL", "documentFileName", "internalMime", 'internalExt'], // Fields
    null, // sort warmup
    null, // sort
    null, // skip
    null, // limit
    false) // count
    .then(function (data) {
      if (data && data.length === 1) {
        var blob = data[0];

        var fileName = blob.documentFileName;
        var fileType = blob.internalExt;
        if (fileName.slice(- fileType.length) !== fileType) {
          fileName = fileName + '.' + fileType;
        }

        // Allow override
        if (args.swagger.params.filename) {
          fileName = args.swagger.params.filename.value;
        }

        var fileMeta;

        // check if the file exists in Minio
        return MinioController.statObject(MinioController.BUCKETS.DOCUMENTS_BUCKET, blob.internalURL)
          .then(function (objectMeta) {
            fileMeta = objectMeta;
            // get the download URL
            return MinioController.getPresignedGETUrl(MinioController.BUCKETS.DOCUMENTS_BUCKET, blob.internalURL);
          }, function () {
            return Actions.sendResponse(res, 404, {});
          })
          .then(function (docURL) {
            Utils.recordAction('Open', 'Document', args.swagger.params.auth_payload.preferred_username, args.swagger.params.docId && args.swagger.params.docId.value ? args.swagger.params.docId.value : null);
            // stream file from Minio to client
            res.setHeader('Content-Length', fileMeta.size);
            res.setHeader('Content-Type', fileMeta.metaData['content-type']);
            res.setHeader('Content-Disposition', 'inline;filename="' + fileName + '"');
            return rp(docURL).pipe(res);
          });
      } else {
        return Actions.sendResponse(res, 404, {});
      }
    });
};

//  Create a new document
exports.protectedPost = async function (args, res, next) {
  console.log("Creating new protected document object");
  var project = args.swagger.params.project.value;
  var _comment = args.swagger.params._comment.value;
  var upfile = args.swagger.params.upfile.value;
  var guid = intformat(generator.next(), 'dec');
  var ext = mime.extension(args.swagger.params.upfile.value.mimetype);
  var tempFilePath = uploadDir + guid + "." + ext;
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
          return Actions.sendResponse(res, 400, { "message": "File failed virus check." });
        } else {
          console.log('writing file.');
          fs.writeFileSync(tempFilePath, args.swagger.params.upfile.value.buffer);
          console.log('wrote file successfully.');

          console.log(MinioController.BUCKETS.DOCUMENTS_BUCKET,
            mongoose.Types.ObjectId(project),
            args.swagger.params.documentFileName.value,
            tempFilePath)

          MinioController.putDocument(MinioController.BUCKETS.DOCUMENTS_BUCKET,
            project,
            args.swagger.params.documentFileName.value,
            tempFilePath)
            .then(async function (minioFile) {
              console.log("putDocument:", minioFile);

              // remove file from temp folder
              fs.unlinkSync(tempFilePath);

              console.log('unlink');

              var Document = mongoose.model('Document');
              var doc = new Document();
              // Define security tag defaults
              doc.project = mongoose.Types.ObjectId(project);
              doc._comment = _comment;
              doc._addedBy = args.swagger.params.auth_payload.preferred_username;
              doc._createdDate = new Date();
              doc.read = ['sysadmin', 'staff'];
              doc.write = ['sysadmin', 'staff'];
              doc.delete = ['sysadmin', 'staff'];

              doc.documentFileName = args.swagger.params.documentFileName.value;
              doc.internalOriginalName = args.swagger.params.internalOriginalName.value;
              doc.internalURL = minioFile.path;
              doc.internalExt = minioFile.extension;
              doc.internalSize = upfile.size;
              doc.passedAVCheck = true;
              doc.internalMime = upfile.mimetype;

              doc.documentSource = args.swagger.params.documentSource.value;

              // TODO Not Yet
              // doc.labels = JSON.parse(args.swagger.params.labels.value);

              doc.displayName = args.swagger.params.displayName.value;
              if (args.swagger.params.eaoStatus && args.swagger.params.eaoStatus.value) {
                doc.eaoStatus = args.swagger.params.eaoStatus.value;
                if (args.swagger.params.eaoStatus.value == 'Published') {
                  doc.read.push('public');
                }
              }
              doc.milestone = mongoose.Types.ObjectId(args.swagger.params.milestone.value);
              doc.type = mongoose.Types.ObjectId(args.swagger.params.type.value);
              doc.documentAuthor = args.swagger.params.documentAuthor.value;

              doc.dateUploaded = args.swagger.params.dateUploaded.value;
              doc.datePosted = args.swagger.params.datePosted.value;
              doc.description = args.swagger.params.description.value;
              doc.projectPhase = mongoose.Types.ObjectId(args.swagger.params.projectPhase.value);
              // Update who did this?
              console.log('unlink');
              doc.save()
                .then(function (d) {
                  defaultLog.info("Saved new document object:", d._id);
                  Utils.recordAction('Post', 'Document', args.swagger.params.auth_payload.preferred_username, d._id);
                  return Actions.sendResponse(res, 200, d);
                })
                .catch(function (error) {
                  console.log("error:", error);
                  // the model failed to be created - delete the document from minio so the database and minio remain in sync.
                  MinioController.deleteDocument(MinioController.BUCKETS.DOCUMENTS_BUCKET, doc.project, doc.internalURL);
                  return Actions.sendResponse(res, 400, error);
                });
            })
        }
      });
  } catch (e) {
    defaultLog.info("Error:", e);
    // Delete the path details before we return to the caller.
    delete e['path'];
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedPublish = async function (args, res, next) {
  var objId = args.swagger.params.docId.value;
  defaultLog.info("Publish Document:", objId);

  var Document = require('mongoose').model('Document');
  try {
    var document = await Document.findOne({ _id: objId });
    if (document) {
      defaultLog.info("Document:", document);
      document.eaoStatus = "Published";
      var published = await Actions.publish(await document.save());
      Utils.recordAction('Publish', 'Document', args.swagger.params.auth_payload.preferred_username, objId);
      return Actions.sendResponse(res, 200, published);
    } else {
      defaultLog.info("Couldn't find that document!");
      return Actions.sendResponse(res, 404, e);
    }
  } catch (e) {
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedUnPublish = async function (args, res, next) {
  var objId = args.swagger.params.docId.value;
  defaultLog.info("UnPublish Document:", objId);

  var Document = require('mongoose').model('Document');
  try {
    var document = await Document.findOne({ _id: objId });
    if (document) {
      defaultLog.info("Document:", document);
      document.eaoStatus = "Rejected";
      var unPublished = await Actions.unPublish(await document.save());
      Utils.recordAction('Unpublish', 'Document', args.swagger.params.auth_payload.preferred_username, objId);
      return Actions.sendResponse(res, 200, unPublished);
    } else {
      defaultLog.info("Couldn't find that document!");
      return Actions.sendResponse(res, 404, e);
    }
  } catch (e) {
    return Actions.sendResponse(res, 400, e);
  }
};

// Update an existing document
exports.protectedPut = async function (args, res, next) {
  console.log("args:", args.swagger.params);
  var objId = args.swagger.params.docId.value;
  var obj = {};
  defaultLog.info('Put document:', objId);

  obj._updatedBy = args.swagger.params.auth_payload.preferred_username;

  obj.displayName = args.swagger.params.displayName.value;

  obj.milestone = args.swagger.params.milestone ? mongoose.Types.ObjectId(args.swagger.params.milestone.value) : null;
  obj.type = args.swagger.params.type ? mongoose.Types.ObjectId(args.swagger.params.type.value) : null;
  obj.documentAuthorType = args.swagger.params.documentAuthorType ? mongoose.Types.ObjectId(args.swagger.params.documentAuthorType.value) : null;
  obj.projectPhase = args.swagger.params.projectPhase ? mongoose.Types.ObjectId(args.swagger.params.projectPhase.value) : null;

  obj.dateUploaded = args.swagger.params.dateUploaded.value;
  obj.datePosted = args.swagger.params.datePosted.value;
  obj.description = args.swagger.params.description.value;
  obj.keywords = args.swagger.params.keywords.value;

  obj.eaoStatus = args.swagger.params.eaoStatus.value;
  if (args.swagger.params.eaoStatus.value === 'Published') {
    obj.read = ['public', 'staff', 'sysadmin'];
  } else if (args.swagger.params.eaoStatus.value === 'Rejected') {
    obj.read = ['staff', 'sysadmin'];
  }

  // TODO Not Yet
  // obj.labels = JSON.parse(args.swagger.params.labels.value);

  defaultLog.info("ObjectID:", objId);

  // Update who did this?

  var Document = mongoose.model('Document');

  try {
    var doc = await Document.findOneAndUpdate({ _id: objId }, obj, { upsert: false, new: true });
    if (doc) {
      Utils.recordAction('put', 'document', args.swagger.params.auth_payload.preferred_username, objId);
      defaultLog.info('Document updated:', doc);
      return Actions.sendResponse(res, 200, doc);
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  } catch (e) {
    defaultLog.info('Error:', e);
    return Actions.sendResponse(res, 400, e);
  }
}

//  Delete a Document
exports.protectedDelete = async function (args, res, next) {
  var objId = args.swagger.params.docId.value;
  defaultLog.info("Delete Document:", objId);

  var Document = require('mongoose').model('Document');
  try {
    var doc = await Document.findOneAndRemove({ _id: objId });
    console.log('deleting document', doc);
    await MinioController.deleteDocument(MinioController.BUCKETS.DOCUMENTS_BUCKET, doc.project, doc.internalURL);
    Utils.recordAction('Delete', 'Document', args.swagger.params.auth_payload.preferred_username, objId);
    return Actions.sendResponse(res, 200, {});
  } catch (e) {
    console.log("Error:", e);
    return Actions.sendResponse(res, 400, e);
  }
};