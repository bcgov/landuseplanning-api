module.exports = require('../models')('ExternalLink', {

    _createdDate: { type: Date, default: Date.now() },
    _updatedDate: { type: Date, default: Date.now() },
    _addedBy: { type: String, default: 'system' },
    _updatedBy: { type: String, default: 'system' },
    _deletedBy: { type: String, default: 'system' },

    read: [{ type: String, trim: true, default: 'sysadmin' }],
    write: [{ type: String, trim: true, default: 'sysadmin' }],
    delete: [{ type: String, trim: true, default: 'sysadmin' }],

		project: { type: 'ObjectId', ref: 'Project', default: null },
    section: { type: 'ObjectId', ref: 'DocumentSection', default: null } | null,
    displayName: { type: String, default:'' },
    externalLink: { type: String, default: '' },
    dateAdded: { type: Date, default: Date.now() },
    dateUpdated: { type: Date, default: Date.now() },
    description: { type: String, default: '' },
    projectPhase: { type: String, default: '' },
		checkbox: { type: Boolean, default: false },
}, 'lup');
