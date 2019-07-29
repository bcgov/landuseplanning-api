var mongoose = require('mongoose');
var Mixed = mongoose.Schema.Types.Mixed;

module.exports = require ('../models')('Document', {
    project         : { type:'ObjectId', ref:'Project', default:null },

    // Tracking
    _comment        : { type:'ObjectId', ref:'CommentPeriod', default:null },
    _createdDate    : { type: Date, default: Date.now() },
    _updatedDate    : { type: Date, default: Date.now() },
    _addedBy        : { type:String, default:'system' },
    _updatedBy      : { type:String, default:'system' },
    _deletedBy      : { type:String, default:'system' },

    // Note: Default on tag property is purely for display only, they have no real effect on the model
    // This must be done in the code.
    read             : [{ type: String, trim: true, default: 'sysadmin' }],
    write            : [{ type: String, trim: true, default: 'sysadmin' }],
    delete           : [{ type: String, trim: true, default: 'sysadmin' }],

    // Not editable
    documentFileName : { type:String, default:'' },
    internalOriginalName : { type:String, default:'' },
    internalURL      : { type:String, default:'' },
    internalExt      : { type:String, default:'' },
    internalSize     : { type:String, default:'' },
    passedAVCheck    : { type: Boolean, default: false },
    internalMime     : { type:String, default:'' },

    // META
    documentSource   : { type:String, default:'' },  // PROJECT/COMMENT/COMMENT_PERIOD/etc

    // Pre-filled with documentFileName in the UI
    displayName      : { type:String, default:'' },
    milestone        : { type:'ObjectId', default:null },
    dateUploaded     : { type: Date, default: Date.now() },
    datePosted       : { type: Date, default: Date.now() },
    type             : { type:'ObjectId', default:null },
    description      : { type:String, default:'' },
    documentAuthor   : { type:'ObjectId', default: null },
    projectPhase     : { type:'ObjectId', default: null },
    eaoStatus        : { type: String, default: '' },
    keywords         : { type: String, default: '' },

    // TODO
    labels           : [{ type: Mixed, default: {} }]

}, 'epic');
