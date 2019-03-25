'use strict';

var dbm;
var type; // eslint-disable-line no-unused-vars
var seed; // eslint-disable-line no-unused-vars

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function(db) {
  return db.addIndex('applications', 'applicationCentroidIndex', { centroid: '2dsphere' }, false, function(err) {
    if (err) {
      console.log('DB Up: applicationCentroidIndex err:', err);
    }
  });
};

exports.down = function(db) {
  return db.removeIndex('applications', 'applicationCentroidIndex', function(err) {
    if (err) {
      console.log('DB Down: applicationCentroidIndex err:', err);
    }
  });
};

exports._meta = {
  version: 1
};
