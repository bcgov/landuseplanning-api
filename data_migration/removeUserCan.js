// database migration script
// renames _addedBy to _createdBy
// is safe to run multiple times

// steps:
// 1. open Robo 3T
// 2. paste the following in a shell
// 3. press F5 to execute

db.projects.updateMany({},
    {
        "$unset": {
             "userCan": ""
        }
    }
)
