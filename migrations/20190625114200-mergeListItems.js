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
        
        // "Enforcement" milestone item in list is "5cf00c03a266b7e1877504ef"

        p.updateOne({"type":"label", "_schemaName":"List", "name": "Enforcement"}, {$set: {"name": "Compliance & Enforcement"}})
        .then(q => {
            // Update the "Compliance" Documents to  point to "Enforcement" id
            p.updateMany({"_schemaName":"Document",  "milestone": "5cf00c03a266b7e1877504f0"},{$set: {"milestone": "5cf00c03a266b7e1877504ef"}});

            // Update "Inspection" Documents to  point to "Enforcement" id
            p.updateMany({"_schemaName":"Document",  "milestone": "5cf00c03a266b7e1877504ee"},{$set: {"milestone": "5cf00c03a266b7e1877504ef"}});
        })
        .then(function(x){
            // Delete the "Compliance", and "Inspection" milestones
            p.deleteOne({"_schemaName":"List", "name": "Compliance"});
            p.deleteOne({"_schemaName":"List", "name": "Inspection"});
        }).then( w =>{
            mClient.close();
        })
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
