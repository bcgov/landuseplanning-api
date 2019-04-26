'use strict';

var dbm;
var type;
var seed;

/**
  * We receive the dbmigrate dependency from dbmigrate initially.
  * This enables us to not have to rely on NODE_PATH.
  */
exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  let mClient;
  return db.connection.connect(db.connectionString, { native_parser: true })
    .then((mClientInst) => {
      // mClientInst is an instance of MongoClient
      mClient = mClientInst;
      var p = mClient.collection('epic');
      p.aggregate([
        {
          $match: { _schemaName: "Project"}
        }
      ])
      .toArray()
      .then(function (arr) {
        for(let item of arr) {
          if (item._id !== '58850ff2aaecd9001b808bae') {
            p.update(
            {
              _id: item._id
            },
            {
              $unset: { directoryStructure: "", userCan: "" }
            });
          } else {
            // Fix for seven mile generating station.
            p.update(
            {
              _id: item._id
            },
            {
              $unset: { directoryStructure: "", userCan: "" },
              $set: { read: ['project-system-admin', 'sysadmin', 'staff', 'public'],
                      write: ['project-system-admin', 'sysadmin', 'staff'],
                      delete: ['project-system-admin', 'sysadmin', 'staff'] }
            });
          }
        }
        mClient.close();
      });
    });
};

exports.down = function (db) {
  return null;
};

exports._meta = {
  "version": 1
};
