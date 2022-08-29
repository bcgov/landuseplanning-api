const mongoose = require('mongoose');
const Mixed = mongoose.Schema.Types.Mixed;

const definition = {
  existingLandUsePlans: { type: Array, default: [] },
  centroid: [{ type: Mixed, default: 0.00 }],
  description: { type: String, default: '' },
  details: { type: String, default: '' },
  logos: { type: Array, default: [] },
  backgroundInfo: { type: String, default: '' },
  engagementStatus: { type: String, default: '' },
  backgroundInfo: { type: String, default:  '' },
  engagementLabel: { type: String, default: '' },
  engagementInfo: { type: String, default: '' },
  documentInfo: { type: String, default: '' },
  overlappingRegionalDistricts: { type: Array, default: [] },
  name: { type: String, trim: true },
  partner: { type: String, trim: true },
  region: { type: String, default: '' },
  agreements: { type: Array, default: [] },
  addedBy: { type: String, default: '' },
  code: { type: String, default: '' },
  commodity: { type: String, default: '' },
  currentPhaseName: { type: String, default: '' },
  dateAdded: { type: String, default: '' },
  dateCommentsClosed: { type: String, default: '' },
  dateCommentsOpen: { type: String, default: '' },
  dateUpdated: { type: Date, default: '' },
  duration: { type: String, default: '' },
  eaoMember: { type: String, default: '' },
  fedElecDist: { type: String, default: '' },
  isTermsAgreed: { type: Boolean, default: false },
  overallProgress: { type: Number },
  primaryContact: { type: String, default: '' },
  proMember: { type: String, default: '' },
  provElecDist: { type: String, default: '' },
  shortName: { type: String, default: '', index: true },
  projectPhase: { type: String, default: '' },
  substitution: { type: Boolean, default: false },
  projectLead: { type: 'ObjectId', ref: 'User', default: null, index: true },
  projectDirector: { type: 'ObjectId', ref: 'User', default: null, index: true },
  pins: [{ type: 'ObjectId', ref: 'Pin', default: null, index: true }],
  pinsHistory: [{ type: Mixed, default: {} }],
  groups: [{ type: 'ObjectId', ref: 'Group', default: null, index: true }],
  // Permissions.
  read: [{ type: String, trim: true, default: '["sysadmin"]' }],
  write: [{ type: String, trim: true, default: '["sysadmin"]' }],
  delete: [{ type: String, trim: true, default: '["sysadmin"]' }],
};

module.exports = require('../models')('Project', definition, 'lup');
