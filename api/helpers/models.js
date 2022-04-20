var mongoose = require('mongoose');
var _ = require('lodash');
var defaultLog = require('winston').loggers.get('defaultLog');

var genSchema = function (name, definition) {
    //
    // ensure
    //
    definition.methods__ = definition.methods__ || {};
    definition.virtuals__ = definition.virtuals__ || [];
    definition.indexes__ = definition.indexes__ || [];
    definition.statics__ = definition.statics__ || {};
    definition.presave__ = definition.presave__ || null;
    //
    // put aside the stuff that must happen post schema creation
    //
    var m = definition.methods__;
    var virtuals = definition.virtuals__;
    var i = definition.indexes__;
    var s = definition.statics__;
    var pre = definition.presave__;
    var post = definition.postsave__;
    definition.methods__ = null;
    definition.virtuals__ = null;
    definition.indexes__ = null;
    definition.statics__ = null;
    definition.presave__ = null;
    delete definition.methods__;
    delete definition.virtuals__;
    delete definition.indexes__;
    delete definition.statics__;
    delete definition.presave__;

    var options;
    if (virtuals) {
        // http://mongoosejs.com/docs/2.7.x/docs/virtuals.html
        options = {
            toObject: {
                virtuals: true
            },
            toJSON: {
                virtuals: true
            }
        };
    }
    //
    // let every model know its schema name in the real world, this is bound
    // to come in handy somewhere, likely with permission setting since the
    // ids are unbound from their model types
    //
    definition._schemaName = { type: String, default: name, index: true };

    //
    // create the schema
    //
    var schema = new mongoose.Schema(definition, options);
    //
    // perform post process stuff
    //
    // Postsave hook
    if (pre) {
        schema.pre('save', pre);
    }
    schema.pre('findOneAndUpdate', function () {
        const update = this.getUpdate();
        if (update.__v != null) {
            delete update.__v;
        }
        const keys = ['$set', '$setOnInsert'];
        for (const key of keys) {
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
    } else {
        // Default - no save hook for audit
        if (name !== 'Audit') {
            // Add the middle ware info
            definition._updatedBy = { type: String, default: "system" };
            definition._addedBy = { type: String, default: "system" };
            definition._deletedBy = { type: String, default: "system" };

            schema.post('save', function (doc) {
                var Audit = mongoose.model('Audit');
                var audit = new Audit({
                    _objectSchema: doc._schemaName,
                    objId: doc._id,
                    updatedBy: doc._updatedBy,
                    addedBy: doc._addedBy
                });
                audit.save();
            });
        }
    }
    if (s) _.extend(schema.statics, s);
    if (m) _.extend(schema.methods, m);
    // if (i) _.each (i, function (d) { schema.index (d); });
    if (virtuals) {
        // http://mongoosejs.com/docs/2.7.x/docs/virtuals.html
        _.forEach(virtuals, function (virtual) {
            var v = schema.virtual(virtual.name);
            if (virtual.get) v.get(virtual.get);
            if (virtual.set) v.set(virtual.set);
        });
    }

    return schema;
};

module.exports = function (name, definition, collection) {
    if (!name || !definition) {
        defaultLog.error('No name or definition supplied when building schema');
        return;
    }
    return mongoose.model(name, genSchema(name, definition), collection);
};