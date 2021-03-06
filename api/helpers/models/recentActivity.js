 module.exports = require ('../models')('RecentActivity', {
    dateUpdated         : { type: Date, default: Date.now() },
    dateAdded           : { type: Date, default: Date.now() },
    _addedBy            : { type: String, default: null },
    _updatedBy          : { type: String, default: null },

    pinned              : { type: Boolean, default: false },
    documentUrl         : { type: String, default: null },
    documentUrlText     : { type: String, default: '' },
    contentUrl          : { type: String, default: null },
    pcp                 : { type: 'ObjectId', ref: 'CommentPeriod', default: null, index: true },
    active              : { type: Boolean, default: false },
    project             : { type: 'ObjectId', ref: 'Project', default: null, index: true },
    content             : { type: String, default: null, index: true },
    headline            : { type: String, default: null, index: true },

    // Permissions
    read             : [{ type: String, trim: true, default: 'sysadmin' }],
    write            : [{ type: String, trim: true, default: 'sysadmin' }],
    delete           : [{ type: String, trim: true, default: 'sysadmin' }],
}, 'lup');
