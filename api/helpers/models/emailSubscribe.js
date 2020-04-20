const randToken = require('rand-token');

module.exports = require('../models')('EmailSubscribe', {
    email: { type: String, trim: true, default: '', index: { unique: true, dropDups: true } },
    project: [{ type: 'ObjectId', ref: 'Project', default: null }],
    confirmed: { type: Boolean, default: false },
    dateSubscribed: { type: Date, default: Date.now() },
    dateConfirmed: { type: Date, default: null },

    // generate a random key for email confirmation
    confirmKey: {type: String, default: function() {
        return randToken.generate(64);
    }},

    // permissions
    read: [{ type: String, trim: true, default: '["project-system-admin"]' }],
    write: [{ type: String, trim: true, default: '["project-system-admin"]' }],
    delete: [{ type: String, trim: true, default: '["project-system-admin"]' }]
}, 'lup');