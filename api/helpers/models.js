const mongoose = require('mongoose');
const _ = require('lodash');
const defaultLog = require('winston').loggers.get('defaultLog');

const genSchema = (name, definition) => {
  // Ensure extension points exist
  definition.methods__ = definition.methods__ || {};
  definition.virtuals__ = definition.virtuals__ || [];
  definition.indexes__ = definition.indexes__ || [];
  definition.statics__ = definition.statics__ || {};
  definition.presave__ = definition.presave__ || null;
  definition.postsave__ = definition.postsave__ || null;

  // Stash extension pieces that must run after schema creation
  const m = definition.methods__;
  const virtuals = definition.virtuals__;
  // Optional index implementation
  // const i = definition.indexes__;
  const s = definition.statics__;
  const pre = definition.presave__;
  const post = definition.postsave__;

  definition.methods__ = null;
  definition.virtuals__ = null;
  definition.indexes__ = null;
  definition.statics__ = null;
  definition.presave__ = null;
  definition.postsave__ = null;

  delete definition.methods__;
  delete definition.virtuals__;
  delete definition.indexes__;
  delete definition.statics__;
  delete definition.presave__;
  delete definition.postsave__;

  // Options: enable virtuals in toObject / toJSON if any are defined
  let options;
  if (virtuals && virtuals.length) {
    // https://mongoosejs.com/docs/virtuals.html
    options = {
      toObject: { virtuals: true },
      toJSON: { virtuals: true },
    };
  }

  // Every model knows its schema name (useful for permissions / auditing)
  definition._schemaName = { type: String, default: name, index: true };

  // If no custom postsave hook and not the Audit model,
  // ensure audit "by" fields exist IN THE SCHEMA (must be set before creating the schema).
  // Original code attempted to set these after schema creation (no effect).
  const shouldInjectAuditDefaults = !post && name !== 'Audit';
  if (shouldInjectAuditDefaults) {
    definition._updatedBy = definition._updatedBy || {
      type: String,
      default: 'system',
    };
    definition._addedBy = definition._addedBy || {
      type: String,
      default: 'system',
    };
    definition._deletedBy = definition._deletedBy || {
      type: String,
      default: 'system',
    };
  }

  //
  // Create the schema
  //
  const schema = new mongoose.Schema(definition, options);

  //
  // Post-process hooks and extensions
  //
  if (pre) {
    schema.pre('save', pre);
  }

  // Increment __v on findOneAndUpdate and strip incoming __v from updates
  schema.pre('findOneAndUpdate', function () {
    const update = this.getUpdate();
    if (update.__v != null) {
      delete update.__v;
    }
    const keys = ['$set', '$setOnInsert'];
    for (let k = 0; k < keys.length; k++) {
      const key = keys[k];
      if (update[key] != null && update[key].__v != null) {
        delete update[key].__v;
        if (Object.keys(update[key]).length === 0) {
          delete update[key];
        }
      }
    }
    update.$inc = update.$inc || {};
    update.$inc.__v = 1;
  });

  if (post) {
    schema.post('save', post);
  } else if (name !== 'Audit') {
    // Default audit save hook when none provided (and not the Audit model itself)
    schema.post('save', function (doc) {
      const Audit = mongoose.model('Audit');
      const audit = new Audit({
        _objectSchema: doc._schemaName,
        objId: doc._id,
        updatedBy: doc._updatedBy,
        addedBy: doc._addedBy,
      });
      audit.save();
    });
  }

  if (s) _.extend(schema.statics, s);
  if (m) _.extend(schema.methods, m);
  // if (i) _.each(i, (d) => { schema.index(d); });

  if (virtuals && virtuals.length) {
    // https://mongoosejs.com/docs/virtuals.html
    _.forEach(virtuals, (virtual) => {
      const v = schema.virtual(virtual.name);
      if (virtual.get) v.get(virtual.get);
      if (virtual.set) v.set(virtual.set);
    });
  }

  return schema;
};

module.exports = (name, definition, collection) => {
  if (!name || !definition) {
    defaultLog.error('No name or definition supplied when building schema');
    return;
  }
  return mongoose.model(name, genSchema(name, definition), collection);
};
