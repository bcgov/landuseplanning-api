// Retrieve
var MongoClient = require('mongodb').MongoClient;
var TreeModel = require('tree-model');
var projects = [];

// Connect to the db
// Dev
// MongoClient.connect("mongodb://user7DW:KKmTLpYBBvbUKAVD@localhost:5555/epic", async function(err, client) {
// Test
MongoClient.connect("mongodb://userS1J:lD8w0UKaYcGaFtW4@localhost:5555/epic", async function(err, client) {
// Local
//MongoClient.connect("mongodb://localhost/epic", async function(err, client) {
  if(!err) {
    console.log("We are connected");
    const db = client.db('epic');

    var data = await getProjects(db);
    console.log("data:", data.length);

    for(let z = 0; z < data.length; z++) {
      await processWork(data[z], db);
    }
    console.log("ALL DONE");
    client.close();
  }
});

async function getProjects(db) {
  return new Promise(function (resolve, reject) {
    db.collection('epic').find({_schemaName: "Project"})
      .toArray()
      .then(async function (data) {
        resolve(data);
      });
  });
}

async function processWork(project, db) {
  return new Promise(function (resolve, reject) {
    db.collection('epic')
    .find({_schemaName: "Document", documentSource: "PROJECT", project: project._id})
    .toArray()
    .then(async function (docs) {
      console.log("Processing docs:", docs.length);
      if (docs && docs.length > 0) {
        for (let i = 0; i < docs.length; i++) {
          var theLabels = await processDocument(project, docs[i].directoryID);
          console.log("Labels:", theLabels);
          if (theLabels !== []) {
            // Update labels on this document.
            await updateDocument(docs[i], theLabels, db);
          }
        }
      }

      resolve(docs);
    });
  });
}

async function updateDocument(document, labels, db) {
  return new Promise(function (resolve, reject) {
    console.log("updating:", document._id);
    console.log("labels:", labels);
    db.collection('epic')
    .update(
      {
          '_id': document._id
      },
      {
        $set: { 'labels': labels }
      }
    );
    resolve();
  });
}

async function processDocument(project, directoryID) {
  console.log("finding:", directoryID);
  console.log("project:", project._id);
  return new Promise(function (resolve, reject) {
    try {
      var labels = [];
      var tree = new TreeModel();
      if (project.directoryStructure !== null) {
        var root = tree.parse(project.directoryStructure);
        var foundNode = null;
        root.walk(function (node) {
          // Halt the traversal by returning false
          if (node.model.id === directoryID) {
            foundNode = node;
            return false;
          }
        });
        // console.log("foundNode:", foundNode);
        if (foundNode) {
          var path = foundNode.getPath();
          // console.log("foundNode:", path)
          path.map(async n => {
            console.log('n:', n.model.name);
            if (n.model.name !== 'ROOT') {
              labels.push(n.model.name);
            }
          });
        } else {
          console.log("Couldn't find any labels for that doc.");
        }
      }
    } catch (e) {
      console.log("ERR:", e);
    }
    // console.log("labels:", labels);

    resolve(labels);
  });
}
