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
          $match: { _schemaName: "Organization" }
        }
      ])
        .toArray()
        .then(function (arr) {
          for (let item of arr) {
            if (item.companyType === 'Proponent') {
              p.update(
                {
                  _id: item._id
                },
                {
                  $set: { companyType: 'Proponent/Certificate Holder' }
                });
            }
            else if (item.companyType === 'Aboriginal Group') {
              p.update(
                {
                  _id: item._id
                },
                {
                  $set: { companyType: 'Indigenous Group' }
                });
            }
          }
          mClient.close();
        });
    })
    .catch((e) => {
      console.log("e:", e);
      mClient.close()
    });
};

exports.down = function (db) {
  return null;
};

exports._meta = {
  "version": 1
};
