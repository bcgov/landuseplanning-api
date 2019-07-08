## How to migrate local database

Go into /migrations, and move the changing file OUT of the folder for now, example: 20190411002817-projectDS.js

then run:

`./prod-load-db/esm_prod_april_1/dataload.sh && ./node_modules/db-migrate/bin/db-migrate up`

then run:

`node migrateDocuments.js`

then put 20190411002817-projectDS.js back into the /migrations folder, and re-run:

`./node_modules/db-migrate/bin/db-migrate up`

note that regionCapitalized file is used to capitalize first letter of a region in database.