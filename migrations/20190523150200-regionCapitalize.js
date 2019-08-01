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
        p.update({"_schemaName":"Project", "region":  "thompson-nicola"},{$set: {"region": "Thompson-Nicola" }},{multi: true});
        p.update({"_schemaName":"Project", "region":  "cariboo"},{$set: {"region": "Cariboo" }},{multi: true});
        p.update({"_schemaName":"Project","region":  "kootenay"},{$set: {"region": "Kootenay" }},{multi: true});
        p.update({"_schemaName":"Project", "region":  "lower mainland"},{$set: {"region": "Lower Mainland" }},{multi: true});
        p.update({"_schemaName":"Project", "region":  "okanagan"},{$set: {"region": "Okanagan" }},{multi: true});
        p.update({"_schemaName":"Project", "region":  "omineca"},{$set: {"region": "Omineca" }},{multi: true});
        p.update({"_schemaName":"Project", "region":  "peace"},{$set: {"region": "Peace" }},{multi: true});
        p.update({"_schemaName":"Project", "region":  "skeena"},{$set: {"region": "Skeena" }},{multi: true});
        p.update({"_schemaName":"Project", "region":  "vancouver island"},{$set: {"region": "Vancouver Island" }},{multi: true});    
        mClient.close()
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
