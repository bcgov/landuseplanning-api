module.exports = require('../models')('Topic', {
    description         : { type: String, default: null },
    name                : { type: String, default: null },
    pillar              : { type: String, default: null },
    parent              : { type: String, default: null },

    // TODO: Decide who should be able to access.
    read                : [{ type: String, trim: true, default: '["project-system-admin"]' }],
});