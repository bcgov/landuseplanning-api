// database migration script
// deletes _proponent (Organization) field from Application collection
// is safe to run multiple times
// NOTE: code below requires MongoDB 3.4

// steps:
// 1. open Robo 3T
// 2. paste the following in a shell
// 3. press F5 to execute

db.applications.aggregate([
  // delete field
  { $project: { _proponent: false } },
  // save as new collection
  { $out: 'applications2' }
]);

// 4. if OK, run the following:

db.applications2.renameCollection('applications', true);
