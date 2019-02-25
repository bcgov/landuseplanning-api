// database migration script
// deletes description field from Decision collection
// run this any time after description was removed: PRC-1029-2 for api/public AND PRC-1029 for admin
// is safe to run multiple times
// NOTE: code below requires MongoDB 3.4

// steps:
// 1. open Robo 3T
// 2. paste the following in a shell
// 3. press F5 to execute

db.decisions.updateMany( {}, { $unset: { description: 1 } } );