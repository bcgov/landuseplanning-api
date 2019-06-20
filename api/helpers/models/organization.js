module.exports = require('../models')('Organization', {
    // Note: Default on tag property is purely for display only, they have no real effect on the model
    // This must be done in the code.
    tags: [[{ type: String, trim: true, default: '[["sysadmin"]]' }]],
    orgName: { type: String, trim: true },
    read: [{ type: String, trim: true, default: '[["sysadmin"]]' }],
    write: [{ type: String, trim: true, default: '[["sysadmin"]]' }],
    delete: [{ type: String, trim: true, default: '[["sysadmin"]]' }]

}, 'gcpe-lup');
