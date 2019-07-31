'use strict';

var dbm;
var type;
var seed;
var mongoose = require('mongoose');

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
  return db.connection.connect(db.connectionString, { native_parser: true})
    .then((mClientInst) => {
      mClient = mClientInst;
      var p = mClient.collection('epic');
      //get list of new author id's
      p.aggregate([
        {
          $match: { $and: [{ _schemaName: "List" }, { type: "author"} ]}
        }
      ])
        .toArray()
        .then((authors) => {
          var author_ids = []
          var public_id;
          var eao_id;
          for (let author of authors) {
            author_ids.push(String(author._id));
            if (author.name === 'Public') {
              public_id = author._id;
            } else if (author.name === 'EAO') {
              eao_id = author._id;
            }
          }
          //get documents to update
          p.aggregate([
            {
              $match: { _schemaName: "Document" }
            }
          ])
            .toArray()
            .then((arr) => {
              for (let item of arr) {
                var docAuthor = item.documentAuthor;
                if (docAuthor) {
                  if (docAuthor === 'EPIC' || docAuthor === 'EPIC DATA CONVERSION') {
                    //SET TO EAO ObjectID  ie.  "5cf00c03a266b7e1877504db"
                    p.update(
                      {
                        _id: item._id
                      },
                      {
                        $set: { documentAuthor: eao_id}
                      }
                    )
                  } else if (docAuthor === 'public') {
                    //SET to PUBLIC ObjectID ie "5cf00c03a266b7e1877504df"
                    p.update(
                      {
                        _id: item._id
                      },
                      {
                        $set: {documentAuthor: public_id}
                      }
                    )
                  } else if (!author_ids.includes(String(docAuthor))) {
                    //set author to null for any entry with a personal name (id. SallyTest, SALLYTEST, Sally Test)
                    p.update(
                      {
                        _id: item._id
                      },
                      {
                        $set: { documentAuthor: null}
                      });
                  }
                }
              }
              mClient.close();
            })
              .catch((err) => {
                console.log("err: ", err);
                mClient.close();
            });
      })
        .catch((err) => {
          console.log("err: ", err);
          mClient.close();
        });
    });
};

exports.down = function(db) {
  return null;
};

exports._meta = {
  "version": 1
};
