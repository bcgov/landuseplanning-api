module.exports = require('../models')('CommentPeriod', {
  _addedBy: { type: String, default: null },
  _application: { type: 'ObjectId', ref: 'Application', default: null, index: true },
  // Note: Default on tag property is purely for display only, they have no real effect on the model
  // This must be done in the code.
  tags: [[{ type: String, trim: true, default: '[["sysadmin"]]' }]],
  name: { type: String, trim: true },

  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  isDeleted: { type: Boolean, default: false }
});
