 module.exports = require ('../models')('Document', {
    // _addedBy         : { type:'ObjectId', ref:'User', default:null },
    // _application     : { type:'ObjectId', ref:'Application', default:null },
    documentFileName : { type:String, default:'' },
    tags             : { type: String, trim: true, default: '' },
    displayName      : { type:String, default:'' },
    internalURL      : { type:String, default:'' },
    internalMime     : { type:String, default:'' }
});
