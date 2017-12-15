var mongoose = require ('mongoose');
var _        = require ('lodash');

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
    // go through and pre-parse the definition
    //
    _.each (definition, function (v, k) {
        if (k.substr(0,2) === '__') {
            delete definition[k];
            decorate[k] (name, definition, v);
        }
    });
    //
    // put aside the stuff that must happen post schema creation
    //
    var m = definition.methods__;
    var virtuals = definition.virtuals__;
    var i = definition.indexes__;
    var s = definition.statics__;
    var p = definition.presave__;
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
    definition._schemaName = {type:String, default:name};
    //
    // create the schema
    //
    var schema = new mongoose.Schema (definition, options);
    //
    // perform post process stuff
    //
    if (p) schema.pre ('save', p);
    if (s) _.extend (schema.statics, s);
    if (m) _.extend (schema.methods, m);
    if (i) _.each (i, function (d) { schema.index (d); });
    if (virtuals) {
        // http://mongoosejs.com/docs/2.7.x/docs/virtuals.html
        _.forEach(virtuals, function(virtual){
            var v = schema.virtual(virtual.name);
            if(virtual.get) v.get(virtual.get);
            if(virtual.set) v.set(virtual.set);
        });
    }

    // Enable FTS on documents
    if (schema.obj._schemaName.default === "Document") {
        schema.index({"$**":"text"});
    }

    return schema;
};

module.exports = function (name, definition) {
    if (!name || !definition) {
        console.error ('No name or definition supplied when building schema');
        return;
    }
    return mongoose.model (name, genSchema  (name, definition));
};