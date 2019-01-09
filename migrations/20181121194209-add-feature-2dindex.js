'use strict';

var dbm;
var type;
var seed;

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
  return db._run('updateMany',
                  'projects', {
                    query: {},
                    update: {$unset: {userCan: ''}},
                    options: {}
                  }
                );
};

exports.down = function(db) {
  return db.removeIndex( 'features',
                         'featureGeometryIndex',
                         function (err) {
                          if (err) {
                            console.log('DB Down: featureGeometryIndex err:', err);
                          }
                        }
  );
};

exports._meta = {
  'version': 1
};
