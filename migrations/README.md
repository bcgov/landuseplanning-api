## How to migrate local database

### Create migration boilerplate

`./node_modules/db-migrate/bin/db-migrate/create myMigrationName`

This will create a date stamped **boilerplate* migration file for you in the `./migrations` directory, such as  *20190625114200-myMigrationName.js* . 
Modify this file to implement your migration. 

### Run a migration

` ./node_modules/db-migrate/bin/db-migrate up`


### Load dump into db and run migrations (optional)


1. Move your newly generated migration file out of the migrations folder(ie. *20190625114200-myMigrationName.js*). This is to ensure a 
clean state to test your new migration against.

2. Run the following command to load a dump file and apply all existing migrations:

    1. `cd dumps_folder && mongorestore -d epic some_unzipped_dump/`
    2. `cd eagle_api_root/ && ./node_modules/db-migrate/bin/db-migrate up`
    2. `node migrateDocuments.js`

3. Put your new migration file back into the **/migrations** folder and run:

    * `./node_modules/db-migrate/bin/db-migrate up`

### Re-run migration (local testing)

** This won't unclobber data, just allow a rerun of a migration. You may 
need to dump and restore if the last migration attempt mangled data. **

1. View all migrations applied, in mongo shell

    * `db.migrations.find()`

2. The most recent migration will be at the bottom of the list

    * `db.migrations.deleteOne({ _id: ObjectId(my_most_recent_migrationd_id)})`
