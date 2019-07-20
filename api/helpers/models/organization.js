module.exports = require('../models')('Organization', {
    _schemaName: { type: String, default: 'Organization' },
    addedBy: { type: 'ObjectId', ref: 'User', default: null, index: true },
    description: { type: String, default: '' },
    name: { type: String, default: '' },
    updatedBy: { type: String, default: '' },
    dateAdded: { type: Date, default: Date.now() },
    dateUpdated: { type: Date, default: Date.now() },
    country: { type: String, default: '' },
    postal: { type: String, default: '' },
    province: { type: String, default: '' },
    city: { type: String, default: '' },
    address1: { type: String, default: '' },
    address2: { type: String, default: '' },
    companyType: { type: String, default: '' },
    parentCompany: { type: 'ObjectId', ref: 'Organization', default: null, index: true },
    companyLegal: { type: String, default: '' },
    company: { type: String, default: '' },

    read: [{ type: String, trim: true, default: 'sysadmin' }],
    write: [{ type: String, trim: true, default: 'sysadmin' }],
    delete: [{ type: String, trim: true, default: 'sysadmin' }]
}, 'epic');
