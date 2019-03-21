module.exports = require('../models')('Review', {
  _addedBy: { type: String, default: null },
  // Reviews map to possibly more than one application
  _applications: [{ type: 'ObjectId', ref: 'Application', default: null }],
  // Note: Default on tag property is purely for display only, they have no real effect on the model
  // This must be done in the code.
  tags: [[{ type: String, trim: true, default: '[["sysadmin"]]' }]],
  code: { type: String, trim: true, default: '' },
  name: { type: String, trim: true }
});
