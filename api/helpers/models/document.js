 module.exports = require ('../models')('Document', {
    project     : { type:'ObjectId', ref:'Project', default:null },
    _comment         : { type:'ObjectId', ref:'CommentPeriod', default:null },
    documentFileName : { type:String, default:'' },
    // Note: Default on tag property is purely for display only, they have no real effect on the model
    // This must be done in the code.
    read             : [{ type: String, trim: true, default: '[["sysadmin"]]' }],
    write            : [{ type: String, trim: true, default: '[["sysadmin"]]' }],
    delete           : [{ type: String, trim: true, default: '[["sysadmin"]]' }],
    displayName      : { type:String, default:'' },
    documentName      : { type:String, default:'' },
    internalURL      : { type:String, default:'' },
    passedAVCheck    : { type: Boolean, default: false },
    internalMime     : { type:String, default:'' },
    documentDate     : { type: Date, default: Date.now() },
    uploadDate       : { type: Date, default: Date.now() },
    milestone        : { type:String, default:'' },
    type             : { type:String, default:'' },
    description      : { type:String, default:'' },

    // TODO: Labels array

    documentAuthor   : { type:String, default:'' } // LEGACY

}, 'epic');
