module.exports = require('../models')('User', {
    sub: { type: String, unique: true},
    firstName: { type: String, trim: true, default: '' },
    middleName: { type: String, trim: true, default: null },
    lastName: { type: String, trim: true, default: '' },
    displayName: { type: String, trim: true },
    email: { type: String, trim: true, default: '' },
    org: { type: 'ObjectId', ref: 'Organization', default: null },
    orgName: { type: String, default: '' },
    title: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    salutation: { type: String, default: '' },
    department: { type: String, default: '' },
    faxNumber: { type: String, default: '' },
    cellPhoneNumber: { type: String, default: '' },
    address1: { type: String, default: '' },
    address2: { type: String, default: '' },
    city: { type: String, default: '' },
    province: { type: String, default: '' },
    country: { type: String, default: '' },
    postalCode: { type: String, default: '' },
    notes: { type: String, default: '' },
    projectPermissions: [{ type: 'ObjectId', ref: 'Project'}],
    read: [{ type: String, trim: true, default: 'sysadmin' }],
    write: [{ type: String, trim: true, default: 'sysadmin' }],
    delete: [{ type: String, trim: true, default: 'sysadmin' }]
}, 'lup');