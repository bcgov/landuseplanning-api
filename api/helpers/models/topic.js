module.exports = require('../models')('Topic', {
    description         : { type: String, default: null },
    name                : { type: String, default: null, index: true },
    pillar              : { type: String, default: null },
    parent              : { type: 'ObjectId', ref: 'Topic', default: null, index: true },

    // TODO: Decide who should be able to access.
    read                : [{ type: String, trim: true, default: '["project-system-admin"]' }],
}, 'epic');