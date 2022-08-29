module.exports = require('../models')('Comment', {
    author: { type: String, default: null },
    project: { type: 'ObjectId', default: null },
    comment: { type: String, default: null },
    dateAdded: { type: Date, default: Date.now() },
    datePosted: { type: Date, default: Date.now() },
    dateUpdated: { type: Date, default: Date.now() },
    documents: [{ type: 'ObjectId', ref: 'Document', default: null, index: true }],
    eaoNotes: { type: String, default: null },
    eaoStatus: { type: String, default: null },
    isAnonymous: { type: Boolean, default: true },
    location: { type: String, default: null },
    period: { type: 'ObjectId', ref: 'CommentPeriod', default: null, index: true },
    proponentNotes: { type: String, default: null },
    proponentStatus: { type: String, default: null },
    publishedNotes: { type: String, default: null },
    rejectedNotes: { type: String, default: null },
    rejectedReason: { type: String, default: null },
    valuedComponents: [{ type: 'ObjectId', ref: 'CommentPeriod', default: null, index: true }],

    // Number auto-incremented.  Do not set manually.
    commentId: { type: Number, default: null },

    // Permissions
    write: [{ type: String, trim: true, default: '["sysadmin"]' }],
    read: [{ type: String, trim: true, default: '["sysadmin"]' }],
    delete: [{ type: String, trim: true, default: '["sysadmin"]' }]
}, 'lup');