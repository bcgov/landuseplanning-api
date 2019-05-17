 module.exports = require ('../models')('RecentActivity', {
    daetUpdated         : { type: Date, default: Date.now() },
    dateAdded           : { type: Date, default: Date.now() },
    _addedBy            : { type: String, default: null },
    _updatedBy          : { type: String, default: null },

    pinned              : { type: Boolean, default: false },
    documentUrl         : { type: String, default: null },
    contentUrl          : { type: String, default: null },
    type                : { type: String, default: null },
    priority            : { type: Number, default: 0 },
    active              : { type: Boolean, default: false },
    project             : { type: 'ObjectId', ref: 'Project', default: null, index: true },
    content             : { type: String, default: null },
    headline            : { type: String, default: null },

    // Permissions
    write               : [{ type: String, trim: true, default: '["project-system-admin"]' }],
    read                : [{ type: String, trim: true, default: '["project-system-admin"]' }],
    delete              : [{ type: String, trim: true, default: '["project-system-admin"]' }]
}, 'epic');
