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
  let mClient;
  return db.connection.connect(db.connectionString, { native_parser: true })
    .then((mClientInst) => {
      // mClientInst is an instance of MongoClient
      mClient = mClientInst;
      var p = mClient.collection('epic');
      p.aggregate([
        {
          $match: { _schemaName: "Project"}
        },
        {
          $project: {
            _id: 1,
            lon: 1,
            lat: 1
          }
        }
      ])
        .toArray()
        .then(function (arr) {
        for(let item of arr) {
          p.update(
          {
            _id: item._id
          },
          {
            $set: { centroid: [item.lon,item.lat] },
            $unset: { lon: "", lat: "" }
          });
        }
        mClient.close();
      });
    })
    .catch((e) => {
      console.log("e:", e);
      mClient.close()
    });
};

exports.down = function(db) {
  return true;
};

exports._meta = {
  'version': 1
};
