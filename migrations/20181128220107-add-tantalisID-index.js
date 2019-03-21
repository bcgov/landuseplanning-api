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
  return db.addIndex('applications', 'tantalisIDIndex', { tantalisID: 1 }, true, function(err) {
    if (err) {
      console.log('DB Up: featureGeometryIndex err:', err);
    }
  });
};

exports.down = function(db) {
  return db.removeIndex('applications', 'tantalisIDIndex', function(err) {
    if (err) {
      console.log('DB Down: featureGeometryIndex err:', err);
    }
  });
};

exports._meta = {
  version: 1
};
