const mongoose = require('mongoose');
const winston = require('winston');
const defaultLog = winston.loggers.get('defaultLog');

/**
 * Runs once in app.js. Builds text schema for:
 * - Project: name
 * - RecentActivity: headline
 * - Document: documentFileName and displayName
 *
 * @returns {void}
 */
module.exports.generateTextIndex = async () => {
  const Project = mongoose.model('Project');
  let schema = new mongoose.Schema();

  try {
    await Project.collection.dropIndex('text_index');
  } catch (e) {
    // Ignore the expected "index not found" cases; log others.
    if (e && (e.code === 27 || e.codeName === 'IndexNotFound')) {
      defaultLog.info('Attempted to remove index: "text_index" not found.');
    } else {
      defaultLog.error('Database generate text index failed', {
        status: e && (e.status || e.statusCode),
        err: { name: e && e.name, message: e && e.message, stack: e && e.stack }
      });
    }
  }

  // Text fields are added on a need-to-index basis. Add additional key-value pairs in first parameter obj
  schema.index(
    {
      name: 'text',
      headline: 'text',
      documentFileName: 'text',
      displayName: 'text',
    },
    { name: 'text_index' },
  );

  return mongoose.model('textSchema', schema, 'lup');
};

/**
 * Fixes a bug where email index had to be unique to the LUP collection instead of just the EmailSubscribe model.
 * Runs silently unless updates are performed
 * 
 * @returns {void}
 */
module.exports.fixEmailIndex = async () => {
  const db = mongoose.connection.db;
  const coll = db.collection('lup');
  const indexes = await coll.indexes();
  const desiredName = 'email_unique_emailSubscribe';
  const desiredKey = { email: 1 };
  const desiredOpts = {
    unique: true,
    partialFilterExpression: { _schemaName: 'EmailSubscribe' },
  };

  // Check if the new, desired index is in the current indexes
  const hasDesired = indexes.some(
    (ix) =>
      ix &&
      ix.unique === true &&
      JSON.stringify(ix.key) === JSON.stringify({ email: 1 }) &&
      JSON.stringify(ix.partialFilterExpression || {}) ===
        JSON.stringify({ _schemaName: 'EmailSubscribe' }),
  );

  // Create a new index if the new, desired index is not found
  if (!hasDesired) {
    try {
      defaultLog.info(`[indexes] creating ${desiredName} ...`);
      await coll.createIndex(
        desiredKey,
        Object.assign({ name: desiredName }, desiredOpts),
      );
      defaultLog.info(`[indexes] created ${desiredName}`);
    } catch (err) {
      defaultLog.error(
        `[indexes] FAILED to create ${desiredName}: ${err && err.message}`,
      );
      return;
    }
  }

  // Check for the legacy unique index that was causing issues
  const newIndexes = await coll.indexes();
  const legacy =
    newIndexes.find(
      (ix) =>
        ix &&
        ix.unique === true &&
        JSON.stringify(ix.key) === JSON.stringify({ email: 1 }) &&
        !ix.partialFilterExpression,
    ) || null;

  // If legacy index present, remove it
  if (legacy) {
    try {
      defaultLog.info(
        `[indexes] dropping legacy global unique index ${legacy.name} ...`,
      );
      await coll.dropIndex(legacy.name);
      defaultLog.info('[indexes] dropped legacy global unique index');
    } catch (err) {
      defaultLog.error(
        `[indexes] FAILED to drop email index: ${err && err.message}`,
      );
      // Not fatal
    }
  }

  // Check if there is a global non-unique index available for the User model
  try {
    const ixList = await coll.indexes();
    const hasGlobalNonUnique = ixList.some(
      (ix) =>
        ix &&
        JSON.stringify(ix.key) === JSON.stringify({ email: 1 }) &&
        ix.unique !== true &&
        !ix.partialFilterExpression,
    );

    // Create the global non-unique index if it doesn't exist
    if (!hasGlobalNonUnique) {
      defaultLog.info(
        '[indexes] creating global non-unique { email: 1 } index (email_1) ...',
      );
      await coll.createIndex(
        { email: 1 },
        { name: 'email_1', background: true /* ignored on MongoDB 4.4+ */ },
      );
      defaultLog.info(
        '[indexes] created global non-unique { email: 1 } index (email_1)',
      );
    }
  } catch (err) {
    defaultLog.error(
      `[indexes] FAILED to ensure global non-unique { email: 1 } index: ${err && err.message}`,
    );
    // Not fatal
  }
};