module.exports = require('../models')('Comment', {
    author              : { type: String, default: null },
    comment              : { type: String, default: null },
    commentId           : { type: Number, default: null },
    dateAdded           : { type: Date, default: Date.now() },
    dateUpdated         : { type: Date, default: Date.now() },
    isAnonymous         : { type: Boolean, default: true },
    location            : { type: String, default: null },
    period              : { type: 'ObjectId', ref: 'CommentPeriod', default: null, index: true },

    // Permissions
    write               : [{ type: String, trim: true, default: '["project-system-admin"]' }],
    read                : [{ type: String, trim: true, default: '["project-system-admin"]' }],
    delete              : [{ type: String, trim: true, default: '["project-system-admin"]' }]
}, 'epic');