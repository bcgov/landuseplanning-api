 module.exports = require ('../models')('Document', {
    _addedBy         : { type:'ObjectId', ref:'User', default:null },
    _application     : { type:'ObjectId', ref:'Application', default:null },
    documentFileName : { type:String, default:'' },
    // Note: Default on tag property is purely for display only, they have no real effect on the model
    // This must be done in the code.
    tags             : [[{ type: String, trim: true, default: '[["sysadmin"]]' }]],
    displayName      : { type:String, default:'' },
    internalURL      : { type:String, default:'' },
    isDeleted        : { type: Boolean, default: false },
    internalMime     : { type:String, default:'' }
});
