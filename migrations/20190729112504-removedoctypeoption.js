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
var mongoose = require('mongoose');

exports.up = function(db) {
    let mClient;
    return db.connection.connect(db.connectionString, { native_parser: true })
      .then((mClientInst) => {
        // mClientInst is an instance of MongoClient
        mClient = mClientInst;
        var p = mClient.collection('epic');
        
        // "Enforcement Action" milestone item in list is "5cf00c03a266b7e1877504d8"
        p.updateMany({_schemaName:"Document","type":mongoose.Types.ObjectId("5cf00c03a266b7e1877504d8")}, {$unset: {"type": ""}})
        .then(
        p.deleteOne({_schemaName:"List", "name":"Enforcement Action"})
        )
        .then(
        mClient.close()
        )
      })
      .catch((e) => {
        console.log("e:", e);
        mClient.close()
      });
  };
  

exports.down = function(db) {
  return null;
};

exports._meta = {
  "version": 1
};
