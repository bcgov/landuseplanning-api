module.exports = require('../models')('Audit', {
    objId         : { type: 'ObjectId', default: null, index: true },
    action        : { type: String, default: null },
    meta          : { type: String, default: null },

    _objectSchema : { type: String, default: null, index: true },

    addedBy       : { type: String, default: null },
    updatedBy     : { type: String, default: null },
    deletedBy     : { type: String, default: null },
    performedBy   : { type: String, default: null },

    timestamp     : { type: Date, default: Date.now() },

    // Permissions
    write         : [{ type: String, trim: true, default: '["project-system-admin"]' }],
    read          : [{ type: String, trim: true, default: '["project-system-admin"]' }],
    delete        : [{ type: String, trim: true, default: '["project-system-admin"]' }]
}, 'audit');