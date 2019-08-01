module.exports = require('../models')('Vc', {
    code: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, default: '' },
    parent: { type: String, default: '' },
    topic: { type: 'ObjectId', ref: 'Topic', default: null, index: true },
    pillar: { type: String, trim: true, default: '' },
    project: { type: 'ObjectId', ref: 'Project', default: null, index: true },
    stage: { type: String, trim: true, default: '' },
    title: { type: String, trim: true, default: '' },
    type: { type: String, trim: true, default: '' },

    // Permissions
    read: [{ type: String, trim: true, default: '["public"]' }],
    write: [{ type: String, trim: true, default: '["project-system-admin"]' }],
    delete: [{ type: String, trim: true, default: '["project-system-admin"]' }]
}, 'lup');