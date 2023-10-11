module.exports = require('../models')('DocumentSection', {
    name: { type: String, default: null },
    project: { type: 'ObjectId', ref: 'Project', default: null },
    order: { type: Number, default: null },

    // permissions
    read: [{ type: String, trim: true, default: '["sysadmin"]' }],
    write: [{ type: String, trim: true, default: '["sysadmin"]' }],
    delete: [{ type: String, trim: true, default: '["sysadmin"]' }]
}, 'lup');