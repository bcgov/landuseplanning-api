var mongoose = require('mongoose');
var _ = require('underscore');
var Mixed = mongoose.Schema.Types.Mixed;

var definition = {

  //Needed for default view
  existingLandUsePlans: { type: String, default: '' },
  centroid: [{ type: Mixed, default: 0.00 }],
  description: { type: String, default: '' },
  engagementStatus: { type: String, default: '' },
  backgroundInfo: { type: String, default: '' },
  overlappingRegionalDistricts: { type: String, default: '' },
  name: { type: String, trim: true, text: true },
  partner: { type: String, trim: true },
  region: { type: String, default: '' },
  agreements: { type: String, trim: true },

  //Everything else
  addedBy: { type: String, default: '' },
  existingLandUsePlanURLs: { type: String, default: '' },
  code: { type: String, default: '' },
  commodity: { type: String, default: '' },
  currentPhaseName: { type: String, default: '' },
  dateAdded: { type: String, default: '' },
  dateCommentsClosed: { type: String, default: '' },
  dateCommentsOpen: { type: String, default: '' },
  dateUpdated: { type: Date, default: '' },
  duration: { type: String, default: '' },
  // TODO: directoryStructure
  eaoMember: { type: String, default: '' },
  // epicProjectID           : { type: Number, default: 0 },
  fedElecDist: { type: String, default: '' },
  isTermsAgreed: { type: Boolean, default: false },
  overallProgress: { type: Number },
  primaryContact: { type: String, default: '' },
  proMember: { type: String, default: '' },
  provElecDist: { type: String, default: '' },
  shortName: { type: String, default: '', index: true },
  projectPhase: { type: String, default: '' },
  substitution: { type: Boolean, default: false },

  /////////////////////
  // Contact references
  /////////////////////
  // Project Lead
  projectLead: { type: 'ObjectId', ref: 'User', default: null, index: true },

  // Executive Project Director
  projectDirector: { type: 'ObjectId', ref: 'User', default: null, index: true },

  //////////////////////

  /////////////////////
  // PINs
  /////////////////////
  pins: [{ type: 'ObjectId', ref: 'Pin', default: null, index: true }],
  /*
    array of mixed:
    [{
      action: 'added' | 'removed',
      date: new Date(now).toISOString()
    }]
  */
  pinsHistory: [{ type: Mixed, default: {} }],

  groups: [{ type: 'ObjectId', ref: 'Group', default: null, index: true }],

  // Permissions
  read: [{ type: String, trim: true, default: '["project-system-admin"]' }],
  write: [{ type: String, trim: true, default: '["project-system-admin"]' }],
  delete: [{ type: String, trim: true, default: '["project-system-admin"]' }],
};

module.exports = require('../models')('Project', definition, 'lup');
