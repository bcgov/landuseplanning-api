// database migration script
// copies publishDate value to createdDate
// for existing applications where publishDate was actually date it was created
// run this after API supports createdDate (PRC-741)
// run this after Admin sets Publish Date correctly (PRC-746)
// is safe to run multiple times
// NOTE: code below requires MongoDB 3.4

// steps:
// 1. open Robo 3T
// 2. paste the following in a shell
// 3. press F5 to execute

db.applications.aggregate([
  {
    $addFields: {
      // if app has a Created Date, does nothing
      // if app doesn't have a Created Date but has a Publish Date, sets createdDate = publishDate
      // if app doesn't have a Created Date or Publish Date, sets createdDate = 'now' (should never happen)
      createdDate: { $ifNull: ['$createdDate', { $ifNull: ['$publishDate', new Date()] }] }
    }
  },
  // save as new collection
  { $out: 'applications2' }
]);

// 4. if OK, run the following:

db.applications2.renameCollection('applications', true);
