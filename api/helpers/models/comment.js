module.exports = require('../models')('Comment', {
  _addedBy: { type: String, default: null },
  _commentPeriod: { type: 'ObjectId', ref: 'CommentPeriod', default: null, index: true },
  // Note: Default on tag property is purely for display only, they have no real effect on the model
  // This must be done in the code.
  tags: [[{ type: String, trim: true, default: '[["sysadmin"]]' }]],
  name: { type: String, trim: true },

  // unique number per application (not guid) for export and sorting
  commentNumber: { type: Number },

  // free form field (supports rich text?)
  comment: { type: String, default: '' },

  commentAuthor: {
    // May reference a particular user in the future.
    _userId: { type: 'ObjectId', ref: 'User' },

    // All the following details are in case there's no binding to a particular user objId
    // TODO: Should this be cleaned up a bit more?
    orgName: { type: String, default: null },
    contactName: { type: String, default: '' },
    location: { type: String, default: '' },

    // Did the user request to be anonymous?
    requestedAnonymous: { type: Boolean, default: false },

    internal: {
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      tags: [[{ type: String, trim: true, default: '[["sysadmin"]]' }]]
    },

    tags: [[{ type: String, trim: true, default: '[["sysadmin"]]' }]]
  },

  // Who vetted this comment?
  review: {
    _reviewerId: { type: 'ObjectId', ref: 'User' },
    reviewerNotes: { type: String, default: '' },
    reviewerDate: { type: Date, default: '' },

    tags: [[{ type: String, trim: true, default: '[["sysadmin"]]' }]]
  },

  // TODO: More date fields?
  dateAdded: { type: Date, default: Date.now() },

  commentStatus: { type: String, default: 'Pending', enum: ['Pending', 'Accepted', 'Rejected'] },
  isDeleted: { type: Boolean, default: false }
});
