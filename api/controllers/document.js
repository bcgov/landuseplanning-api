const { remove, indexOf, assignIn } = require('lodash');
const defaultLog = require('winston').loggers.get('defaultLog');
const mongoose = require('mongoose');
const mime = require('mime-types');
const Actions = require('../helpers/actions');
const Utils = require('../helpers/utils');
const FlakeIdGen = require('flake-idgen');
const intformat = require('biguint-format');
const generator = new FlakeIdGen();
const fs = require('fs');
const uploadDir = process.env.UPLOAD_DIRECTORY || './uploads/';
const ENABLE_VIRUS_SCANNING = process.env.ENABLE_VIRUS_SCANNING || false;
const MinioController = require('../helpers/minio');
const rp = require('request-promise-native');

const getSanitizedFields = (fields = []) => {
  return remove(fields, (f) => {
    return (
      indexOf(
        [
          '_addedBy',
          'documentFileName',
          'alt',
          'internalExt',
          'internalOriginalName',
          'displayName',
          'section',
          'labels',
          'datePosted',
          'dateUploaded',
          'dateReceived',
          'documentFileSize',
          'documentSource',
          'eaoStatus',
          'internalURL',
          'internalSize',
          'checkbox',
          'project',
          'documentAuthor',
          'projectPhase',
          'description',
          'keywords',
          'isPublished',
          'internalMime',
        ],
        f,
      ) !== -1
    );
  });
};

exports.protectedOptions = (args, res) => {
  defaultLog.info('DOCUMENT PROTECTED OPTIONS');
  res.status(200).send();
};

exports.publicGet = async (args, res) => {
  defaultLog.info('DOCUMENT PUBLIC GET');
  // Build match query
  let query = {};
  if (args.swagger.params.docId && args.swagger.params.docId.value) {
    query = Utils.buildQuery('_id', args.swagger.params.docId.value, query);
  } else if (
    args.swagger.params.docIds &&
    args.swagger.params.docIds.value &&
    args.swagger.params.docIds.value.length > 0
  ) {
    query = Utils.buildQuery('_id', args.swagger.params.docIds.value);
  }

  if (args.swagger.params.project && args.swagger.params.project.value) {
    query = Utils.buildQuery(
      'project',
      args.swagger.params.project.value,
      query,
    );
  }

  if (
    args.swagger.params.documentSource &&
    args.swagger.params.documentSource.value
  ) {
    assignIn(query, {
      documentSource: args.swagger.params.documentSource.value,
    });
  }

  // Set query type
  assignIn(query, { _schemaName: 'Document' });

  try {
    const data = await Utils.runDataQuery(
      'Document',
      ['public'],
      null,
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null, // sort warmup
      null, // sort
      null, // skip
      null, // limit
      false, // count
    );
    defaultLog.info('Got document(s):', data);
    Utils.recordAction(
      'Get',
      'Document',
      'public',
      args.swagger.params.docId && args.swagger.params.docId.value
        ? args.swagger.params.docId.value
        : null,
    );
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    return Actions.sendResponse(res, 400, e, 'Document public get failed');
  }
};

exports.unProtectedPost = async (args, res) => {
  defaultLog.info('DOCUMENT PUBLIC POST');
  const _comment = args.swagger.params._comment.value;
  const project = args.swagger.params.project.value;
  const upfile = args.swagger.params.upfile.value;
  const guid = intformat(generator.next(), 'dec');
  const ext = mime.extension(args.swagger.params.upfile.value.mimetype);
  const tempFilePath = `${uploadDir}${guid}.${ext}`;

  try {
    // Virus scan (optional)
    const valid =
      ENABLE_VIRUS_SCANNING === 'true'
        ? await Utils.avScan(args.swagger.params.upfile.value.buffer)
        : true;

    if (!valid) {
      defaultLog.warn('File failed virus check.');
      return Actions.sendResponse(res, 400, {
        message: 'File failed virus check.',
      });
    }

    fs.writeFileSync(tempFilePath, args.swagger.params.upfile.value.buffer);
    defaultLog.info('wrote file successfully.');
    const minioFile = await MinioController.putDocument(
      MinioController.BUCKETS.DOCUMENTS_BUCKET,
      project,
      upfile.originalname,
      tempFilePath,
    );

    // Remove temp file
    try {
      fs.unlinkSync(tempFilePath);
    } catch (e) {
      defaultLog.warn('Could not clean temp file', {
        status: e && (e.status || e.statusCode),
        err: { name: e && e.name, message: e && e.message, stack: e && e.stack }
      });
    }

    // Define security tag defaults
    const Document = mongoose.model('Document');
    const doc = new Document({
      project: mongoose.Types.ObjectId(project),
      _comment: _comment,
      _addedBy: 'public',
      _createdDate: new Date(),
      read: ['sysadmin', 'staff'],
      write: ['sysadmin', 'staff'],
      delete: ['sysadmin', 'staff'],

      internalOriginalName: upfile.originalname,
      internalURL: minioFile.path,
      internalExt: minioFile.extension,
      internalSize: upfile.size,
      passedAVCheck: true,
      internalMime: upfile.mimetype,

      documentSource: 'COMMENT',
      displayName: upfile.originalname,
      documentFileName: upfile.originalname,
      dateUploaded: new Date(),
      datePosted: new Date(),
      documentAuthor: args.body.documentAuthor,
    });

    const d = await doc.save();
    defaultLog.info('Saved new document object:', d._id);

    const Comment = mongoose.model('Comment');
    const result = await Comment.updateOne(
      { _id: _comment },
      { $addToSet: { documents: d._id } },
    );
    defaultLog.info('Comment update result:', {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });

    Utils.recordAction('Post', 'Document', 'public', d._id);
    return Actions.sendResponse(res, 200, d);
  } catch (e) {
      // Delete the path details before we return to the caller.
      delete e.path;
      return Actions.sendResponse(
        res,
        400,
        e,
        'Document unprotected post failed',
      );
  }
};

exports.protectedHead = async (args, res) => {
  defaultLog.info('DOCUMENT PROTECTED HEAD');
  // Build match query
  let query = {};
  const { docId, _application, _comment, isDeleted, auth_payload } =
    args.swagger.params;
  if (docId && docId.value) {
    query = Utils.buildQuery('_id', docId.value, query);
  }
  if (_application && _application.value) {
    query = Utils.buildQuery('_application', _application.value, query);
  }
  if (_comment && _comment.value) {
    query = Utils.buildQuery('_comment', _comment.value, query);
  }
  // Unless they specifically ask for it, hide deleted results.
  if (isDeleted && isDeleted.value !== undefined) {
    assignIn(query, { isDeleted: isDeleted.value });
  }
  // Set query type
  assignIn(query, { _schemaName: 'Document' });

  try {
    const data = await Utils.runDataQuery(
      'Document',
      auth_payload.client_roles,
      auth_payload.idir_user_guid,
      query,
      ['_id', 'read'], // Fields
      null, // sort warmup
      null, // sort
      null, // skip
      null, // limit
      true, // count
    );

    Utils.recordAction(
      'Head',
      'Document',
      auth_payload.preferred_username,
      docId && docId.value ? docId.value : null,
    );

    if (!(docId && docId.value) || (data && data.length > 0)) {
      res.setHeader(
        'x-total-count',
        data && data.length > 0 ? data[0].total_items : 0,
      );
      return Actions.sendResponse(res, 200, data);
    } else {
      return Actions.sendResponse(res, 404, data);
    }
  } catch (e) {
    return Actions.sendResponse(res, 400, e, 'Document protected head failed');
  }
}

exports.protectedGet = async (args, res) => {
  defaultLog.info('DOCUMENT PROTECTED GET');
  let query = {},
    sort = {},
    skip = null,
    limit = null,
    count = false;

  // Build match query
  const docId = args.swagger.params.docId || null;
  const docIds = args.swagger.params.docIds || null;
  if (docId && docId.value) {
    assignIn(query, { _id: mongoose.Types.ObjectId(docId.value) });
  } else if (docIds && docIds.value && docIds.value.length > 0) {
    const objIds = docIds.value.map((id) => mongoose.Types.ObjectId(id));
    query = Utils.buildQuery('_id', objIds);
  }

  const project = args.swagger.params.project || null;
  if (project && project.value) {
    query = Utils.buildQuery('project', project.value, query);
  }

  // Set query type
  assignIn(query, { _schemaName: 'Document' });

  try {
    const data = await Utils.runDataQuery(
      'Document',
      args.swagger.params.auth_payload.client_roles,
      args.swagger.params.auth_payload.idir_user_guid,
      query,
      getSanitizedFields(args.swagger.params.fields.value), // Fields
      null, // sort warmup
      sort, // sort
      skip, // skip
      limit, // limit
      count, // count
    );
    Utils.recordAction(
      'Get',
      'Document',
      args.swagger.params.auth_payload.preferred_username,
      docId && docId.value ? docId.value : null,
    );
    defaultLog.info('Got document(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    return Actions.sendResponse(res, 400, e, 'Document protected get failed');
  }
}

exports.publicDownload = async (args, res) => {
  defaultLog.info('DOCUMENT PUBLIC DOWNLOAD');

  // Build match query
  let query = {};
  if (args.swagger.params.docId && args.swagger.params.docId.value) {
    query = Utils.buildQuery('_id', args.swagger.params.docId.value, query);
  } else {
    return Actions.sendResponse(res, 404, {});
  }
  // Set query type
  assignIn(query, { _schemaName: 'Document' });

  try {
    const data = await Utils.runDataQuery(
      'Document',
      ['public'],
      null,
      query,
      ['internalURL', 'documentFileName', 'internalMime', 'internalExt'], // Fields
      null, // sort warmup
      null, // sort
      null, // skip
      null, // limit
      false, // count
    );

    if (data && data.length === 1) {
      const blob = data[0];

      let fileName = blob.documentFileName;
      const fileType = blob.internalExt;
      if (!fileName.endsWith(fileType)) {
        fileName = `${fileName}.${fileType}`;
      }

      // check if the file exists in Minio
      const fileMeta = await MinioController.statObject(
        MinioController.BUCKETS.DOCUMENTS_BUCKET,
        blob.internalURL,
      );
      // get the download URL
      const docURL = await MinioController.getPresignedGETUrl(
        MinioController.BUCKETS.DOCUMENTS_BUCKET,
        blob.internalURL,
      );

      Utils.recordAction(
        'Download',
        'Document',
        'public',
        args.swagger.params.docId && args.swagger.params.docId.value
          ? args.swagger.params.docId.value
          : null,
      );

      // stream file from Minio to clients
      res.setHeader('Content-Length', fileMeta.size);
      res.setHeader('Content-Type', fileMeta.metaData['content-type']);
      res.setHeader('Content-Disposition', `attachment;filename="${fileName}"`);
      defaultLog.info('Downloading file: ', args.swagger.params.docId.value);
      return rp(docURL).pipe(res);
    } else {
      defaultLog.error('Error downloading file in document public download.');
      return Actions.sendResponse(res, 404, {});
    }
  } catch (e) {
    return Actions.sendResponse(
      res,
      500,
      {},
      'Document public download failed',
    );
  }
}

exports.protectedDownload = async (args, res) => {
  defaultLog.info('DOCUMENT PROTECTED DOWNLOAD');
  defaultLog.info(
    'args.swagger.params:',
    args.swagger.params.auth_payload.client_roles,
  );

  // Build match query
  let query = {};
  if (args.swagger.params.docId && args.swagger.params.docId.value) {
    query = Utils.buildQuery('_id', args.swagger.params.docId.value, query);
  }
  // Set query type
  assignIn(query, { _schemaName: 'Document' });

  try {
    const data = await Utils.runDataQuery(
      'Document',
      args.swagger.params.auth_payload.client_roles,
      args.swagger.params.auth_payload.idir_user_guid,
      query,
      ['internalURL', 'documentFileName', 'internalMime', 'internalExt'], // Fields
      null, // sort warmup
      null, // sort
      null, // skip
      null, // limit
      false, // count
    );

    if (data && data.length === 1) {
      const blob = data[0];

      let fileName = blob.documentFileName;
      const fileType = blob.internalExt;
      if (!fileName.endsWith(fileType)) {
        fileName = `${fileName}.${fileType}`;
      }

      // check if the file exists in Minio
      const fileMeta = await MinioController.statObject(
        MinioController.BUCKETS.DOCUMENTS_BUCKET,
        blob.internalURL,
      );
      // get the download URL
      const docURL = await MinioController.getPresignedGETUrl(
        MinioController.BUCKETS.DOCUMENTS_BUCKET,
        blob.internalURL,
      );

      Utils.recordAction(
        'Download',
        'Document',
        args.swagger.params.auth_payload.preferred_username,
        args.swagger.params.docId && args.swagger.params.docId.value
          ? args.swagger.params.docId.value
          : null,
      );

      // stream file from Minio to client
      res.setHeader('Content-Length', fileMeta.size);
      res.setHeader('Content-Type', fileMeta.metaData['content-type']);
      res.setHeader('Content-Disposition', `attachment;filename="${fileName}"`);
      return rp(docURL).pipe(res);
    } else {
      return Actions.sendResponse(res, 404, {});
    }
  } catch (e) {
    return Actions.sendResponse(
      res,
      500,
      {},
      'Document protected download failed',
    );
  }
}

exports.protectedOpen = async (args, res) => {
  defaultLog.info('DOCUMENT PROTECTED OPEN');

  try {
    // Build match query
    let query = {};
    if (args.swagger.params.docId && args.swagger.params.docId.value) {
      query = Utils.buildQuery('_id', args.swagger.params.docId.value, query);
    }
    assignIn(query, { _schemaName: 'Document' });

    const data = await Utils.runDataQuery(
      'Document',
      ['public'],
      false,
      query,
      ['internalURL', 'documentFileName', 'internalMime', 'internalExt'], // Fields
      null, // sort warmup
      null, // sort
      null, // skip
      null, // limit
      false, // count
    );

    if (!data || data.length !== 1) {
      return Actions.sendResponse(res, 404, {});
    }

    const blob = data[0];

    const requestedFilename =
      args.swagger.params.filename && args.swagger.params.filename.value
        ? args.swagger.params.filename.value
        : null;

    let fileName = requestedFilename || blob.documentFileName;
    const fileType = blob.internalExt;
    if (!fileName.endsWith(fileType)) {
      fileName = `${fileName}.${fileType}`;
    }

    defaultLog.info('Searching minio for file');

    const fileMeta = await MinioController.statObject(
      MinioController.BUCKETS.DOCUMENTS_BUCKET,
      blob.internalURL,
    );
    defaultLog.info('file found:', fileMeta);

    const docURL = await MinioController.getPresignedGETUrl(
      MinioController.BUCKETS.DOCUMENTS_BUCKET,
      blob.internalURL,
    );

    Utils.recordAction(
      'Open',
      'Document',
      args.swagger.params.auth_payload &&
        args.swagger.params.auth_payload.preferred_username,
      (args.swagger.params.docId && args.swagger.params.docId.value) || null,
    );

    // stream file from Minio to client
    res.setHeader('Content-Length', fileMeta.size);
    res.setHeader('Content-Type', fileMeta.metaData['content-type']);
    res.setHeader('Content-Disposition', `inline;filename="${fileName}"`);

    return rp(docURL).pipe(res);
  } catch (e) {
    const errorDetails = 'Document protected open failed';
    const statusCode =
      e &&
      (e.code === 'NoSuchKey' || (e.message && e.message.includes('not found')))
        ? 404
        : 500;
    if (!res.headersSent) {
      return Actions.sendResponse(res, statusCode, e, errorDetails);
    } else {
      defaultLog.error({
        details: errorDetails,
        status: statusCode,
        message: e && e.message,
        stack: e && e.stack,
      });
    }

    res.end();
  }
};

//  Create a new document
exports.protectedPost = async (args, res) => {
  defaultLog.info('DOCUMENT PROTECTED POST');
  try {
    const project = args.swagger.params.project.value;
    const _comment = args.swagger.params._comment.value;
    const upfile = args.swagger.params.upfile.value;
    const guid = intformat(generator.next(), 'dec');
    const ext = mime.extension(args.swagger.params.upfile.value.mimetype);
    const tempFilePath = `${uploadDir}${guid}.${ext}`;

    const valid =
      ENABLE_VIRUS_SCANNING === 'true'
        ? await Utils.avScan(args.swagger.params.upfile.value.buffer)
        : true;

    if (!valid) {
      defaultLog.warn('File failed virus check.');
      return Actions.sendResponse(res, 400, {
        message: 'File failed virus check.',
      });
    }

    fs.writeFileSync(tempFilePath, args.swagger.params.upfile.value.buffer);
    defaultLog.info('wrote file successfully.');

    const minioFile = await MinioController.putDocument(
      MinioController.BUCKETS.DOCUMENTS_BUCKET,
      project,
      args.swagger.params.documentFileName.value,
      tempFilePath,
    );
    defaultLog.info('File saved in minio. Now saving document in DB.');

    // remove file from temp folder
    try {
      fs.unlinkSync(tempFilePath);
    } catch (e) {
      defaultLog.warn({
        details: 'Could not clean temp file',
        status: e && (e.status || e.statusCode || undefined),
        message: e && e.message,
        stack: e && e.stack,
      });
    }

    const Document = mongoose.model('Document');
    const params = args.swagger.params;
    const doc = new Document({
      project: mongoose.Types.ObjectId(project),
      _comment: _comment,
      _addedBy: params.auth_payload.preferred_username,
      _createdDate: new Date(),
      read: ['sysadmin', 'staff'],
      write: ['sysadmin', 'staff'],
      delete: ['sysadmin', 'staff'],
      documentFileName: params.documentFileName.value,
      alt: params.alt.value,
      internalOriginalName: params.internalOriginalName.value,
      internalURL: minioFile.path,
      internalExt: minioFile.extension,
      internalSize: upfile.size,
      passedAVCheck: true,
      internalMime: upfile.mimetype,
      documentSource: params.documentSource.value,
      section: params.section.value === 'null' ? null : params.section.value,
      displayName: params.displayName.value,
      eaoStatus: (params.eaoStatus && params.eaoStatus.value) || null,
      documentAuthor: params.documentAuthor.value,
      dateUploaded: params.dateUploaded.value,
      datePosted: params.datePosted.value,
      description: params.description.value,
      projectPhase: params.projectPhase.value,
    });
    defaultLog.info('Mapped values to document');

    if (params.eaoStatus && params.eaoStatus.value === 'Published') {
      doc.read.push('public');
    }

    const d = await doc.save();
    defaultLog.info('Saved new document object:', d._id);
    Utils.recordAction(
      'Post',
      'Document',
      args.swagger.params.auth_payload.preferred_username,
      d._id,
    );
    return Actions.sendResponse(res, 200, d);
  } catch (e) {
    // Delete the path details before we return to the caller.
    delete e.path;
    return Actions.sendResponse(res, 500, e, 'Document protected post failed');
  }
};

exports.protectedPublish = async (args, res) => {
  defaultLog.info('DOCUMENT PROTECTED PUBLISH');
  const objId = args.swagger.params.docId.value;
  defaultLog.info('Publish Document:', objId);

  const Document = mongoose.model('Document');
  try {
    const document = await Document.findById(objId);
    if (!document) {
      defaultLog.info('Couldn’t find that document!');
      return Actions.sendResponse(res, 404, { message: 'Document not found' });
    }
    document.eaoStatus = 'Published';
    document.section = document.section === '' ? undefined : document.section;
    const saved = await document.save();
    const published = await Actions.publish(saved);
    Utils.recordAction(
      'Publish',
      'Document',
      args.swagger.params.auth_payload.preferred_username,
      objId,
    );
    return Actions.sendResponse(res, 200, published);
  } catch (e) {
    return Actions.sendResponse(
      res,
      400,
      e,
      'Document protected publish failed',
    );
  }
};

exports.protectedUnPublish = async (args, res) => {
  defaultLog.info('DOCUMENT PROTECTED UNPUBLISH');
  const objId = args.swagger.params.docId.value;
  defaultLog.info('UnPublish Document:', objId);
  const Document = mongoose.model('Document');
  try {
    const document = await Document.findById(objId);
    if (!document) {
      return Actions.sendResponse(res, 404, { message: 'Document not found' });
    }
    document.eaoStatus = 'Rejected';
    document.section = document.section === '' ? undefined : document.section;
    const saved = await document.save();
    const unPublished = await Actions.unPublish(saved);
    Utils.recordAction(
      'Unpublish',
      'Document',
      args.swagger.params.auth_payload.preferred_username,
      objId,
    );
    return Actions.sendResponse(res, 200, unPublished);
  } catch (e) {
    return Actions.sendResponse(
      res,
      400,
      e,
      'Document protected unpublish failed',
    );
  }
};

// Update an existing document
exports.protectedPut = async (args, res) => {
  const params = args.swagger.params;
  defaultLog.info('DOCUMENT PROTECTED PUT');
  const objId = params.docId.value;
  defaultLog.info('Put document:', objId);

  const patch = {
    _updatedBy: params.auth_payload.preferred_username,
    displayName: params.displayName.value,
    section: params.section.value === 'null' ? null : params.section.value,
    alt: params.alt.value,
    projectPhase: params.projectPhase.value,
    dateUploaded: params.dateUploaded.value,
    datePosted: params.datePosted.value,
    description: params.description.value,
    keywords: params.keywords.value,
  };

  const Document = mongoose.model('Document');

  try {
    const doc = await Document.findByIdAndUpdate(objId, patch, {
      upsert: false,
      new: true,
    });
    if (doc) {
      Utils.recordAction(
        'put',
        'document',
        args.swagger.params.auth_payload.preferred_username,
        objId,
      );
      defaultLog.info('Document updated:', objId);
      return Actions.sendResponse(res, 200, doc);
    } else {
      defaultLog.info("Couldn't find that object!");
      return Actions.sendResponse(res, 404, {});
    }
  } catch (e) {
    return Actions.sendResponse(res, 400, e, 'Document protected put failed');
  }
};

//  Delete a Document
exports.protectedDelete = async (args, res) => {
  defaultLog.info('DOCUMENT PROTECTED DELETE');
  const objId = args.swagger.params.docId.value;
  defaultLog.info('Delete Document:', objId);

  const Document = mongoose.model('Document');
  try {
    const doc = await Document.findByIdAndDelete(objId);
    if (!doc) {
      return Actions.sendResponse(res, 404, { message: 'Document not found' });
    }
    await MinioController.deleteDocument(
      MinioController.BUCKETS.DOCUMENTS_BUCKET,
      doc.project,
      doc.internalURL,
    );
    Utils.recordAction(
      'Delete',
      'Document',
      args.swagger.params.auth_payload.preferred_username,
      objId,
    );
    return Actions.sendResponse(res, 200, {});
  } catch (e) {
    return Actions.sendResponse(
      res,
      400,
      e,
      'Document protected delete failed',
    );
  }
};
