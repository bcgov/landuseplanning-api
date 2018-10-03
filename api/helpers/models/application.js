 module.exports = require ('../models')('Application', {
    _addedBy         : { type:'ObjectId', ref:'User', default:null },
    _proponent       : { type:'ObjectId', ref:'Organization', default:null },

    agency           : { type:String, default: '' },
    areaHectares     : { type: Number, default: 0.00 },
    businessUnit     : { type: String },

    // Centroid (in coordinates) of all features associated with this application.
    centroid         : [{ type: Number, default: 0.00}],

    cl_file          : { type:Number, default: 0 },
    client           : { type:String, default: '' },
    code             : { type: String, trim: true, default: ''},
    description      : { type:String, default: '' },
    internal: {
        notes   : { type: String, default: '' },
        tags    : [[{ type: String, trim: true, default: '[["sysadmin"]]' }]]
    },
    isDeleted        : { type: Boolean, default: false },
    legalDescription : { type: String },
    location         : { type: String, default: '' },
    name             : { type: String, trim: true },
    publishDate      : { type: Date, default: Date.now },
    purpose          : { type: String },
    status           : { type: String },
    subpurpose       : { type: String },
    subtype          : { type: String },
    tantalisID       : { type:Number, default: 0 },
    tenureStage      : { type: String },
    type             : { type: String },

    // Note: Default on tag property is purely for display only, they have no real effect on the model.
    // This must be done in the code.
    tags             : [[{ type: String, trim: true, default: '[["sysadmin"]]' }]],
});
