// Retrieve
var MongoClient = require('mongodb').MongoClient;
var MinioController = require('./api/helpers/minio');
var Utils = require('./api/helpers/utils');
var mongoose = require('mongoose');
var TreeModel = require('tree-model');
var projects = [];
var doneProjects = require('./doneProjects');
var fs = require('fs');

// Connect to the db
// Dev
// MongoClient.connect("mongodb://x:x@localhost:5555/epic", async function(err, client) {
// Test
// MongoClient.connect("mongodb://x:x@localhost:5555/epic", async function (err, client) {
  // Local
  MongoClient.connect("mongodb://localhost/epic", async function(err, client) {
  if (!err) {
    console.log("We are connected");
    const db = client.db('epic');

    var data = await getProjects(db);
    console.log("data:", data.length);

    for (let z = 0; z < data.length; z++) {
 
      var filedata = fs.readFileSync('doneProjects.json', 'utf8');
      obj = JSON.parse(filedata); //now it an object

      var found = false;
      obj.map(item => {
        console.log("i:", item.id);
        console.log("z:", '' + data[z]._id);
        if (item.id == data[z]._id) {
          found = true;
	}
      });
      if (!found) {
        await processWork(data[z], db);
        obj.push({id: '' + data[z]._id}); //add some data
        json = JSON.stringify(obj); //convert it back to json
        fs.writeFileSync('doneProjects.json', json, 'utf8'); // write it back 
      } else {
        console.log("skipping: ", data[z]._id);
      }
    }
    console.log("ALL DONE");
    client.close();
  }
});

async function getProjects(db) {
  return new Promise(function (resolve, reject) {
    db.collection('epic').find({ _schemaName: "Project" })
      .toArray()
      .then(async function (data) {
        resolve(data);
      });
  });
}

async function processWork(project, db) {
  return new Promise(function (resolve, reject) {
    db.collection('epic')
      .find({ _schemaName: "Document", documentSource: "PROJECT", project: project._id })
      .toArray()
      .then(async function (docs) {
        console.log("Processing docs:", docs.length);
        if (docs && docs.length > 0) {
          for (let i = 0; i < docs.length; i++) {
            var fileSize = await processDocument(project, docs[i]._id, db);
            if (fileSize !== null) {
              console.log("File size:", fileSize);
              // Update labels on this document.
              await updateDocument(docs[i], fileSize, db);
            }
          }
        }
        resolve(docs);
      });
  });
}

async function updateDocument(document, fileSize, db) {
  return new Promise(function (resolve, reject) {
    console.log("updating:", document._id);
    console.log("fileSize:", fileSize);

    // console.log(document)

    var setObj = { 'internalSize': parseFloat(fileSize) };

    try {
      if (document.type && mongoose.Types.ObjectId(document.type)) {
        // Update types
        setObj['type'] = mongoose.Types.ObjectId(document.type);
      }
    } catch (e) {

    }
    try {
      if (document.milestone && mongoose.Types.ObjectId(document.milestone)) {
        // Update types
        setObj['milestone'] = mongoose.Types.ObjectId(document.milestone);
      }
    } catch (e) {

    }
    try {
      if (document.documentAuthor && mongoose.Types.ObjectId(document.documentAuthor)) {
        // Update types
        setObj['documentAuthor'] = mongoose.Types.ObjectId(document.documentAuthor);
      }
    } catch (e) {

    }

    db.collection('epic')
    .update(
      {
        '_id': document._id
      },
      {
        $set: setObj
      }
      // {
      //   $unset: { documentFileSize: "" }
      // }
    ).then(function (f) {
      resolve();
    }).catch(function (x) {
      console.log("e:", x);
    });
  });
}

async function processDocument(project, id, db) {
  return new Promise(function (resolve, reject) {
    console.log("finding docid:", id);
    console.log("project:", project._id);
    db.collection('epic')
    .find({_id: id})
    .toArray()
    .then(function (data) {
      if (data && data.length === 1) {
        // check if the file exists in Minio
        return MinioController.statObject(MinioController.BUCKETS.DOCUMENTS_BUCKET, data[0].internalURL)
          .then(function (objectMeta) {
            console.log('File size:', objectMeta.size);
            resolve(objectMeta.size);
          }, function () {
            resolve(null);
          })
      } else {
        resolve(null);
      }
    });
  });
}
