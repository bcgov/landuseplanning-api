# Local Database Setup

Land Use Planning/Planning in Partnership currently uses `mongo 3.6.3`.

## Prerequisites

- `docker`, `docker compose`
- Some tool to connect to the DB manually. Since the database version is old, you may need to use an older tool. Studio 3T free is one option. Make sure you use the 2024.4.1 version as later versions aren't able to connect to MongoDB 3.


## Installation

1. Run `docker compose up` in this directory.
2. Connect to the DB. The authentication details are in `docker-compose.yaml`. Be sure you use `SCRAM-SHA-1` encryption when connecting. The authentication database is `admin`.
3. Once connected, add a new database (in Studio 3t, click on the connection in the left-side panel find the "Add Database..." option) option. Call it `landuseplanning`.
4. Create a new database. In Studio 3T, right-click on the newly-created languseplanning DB and find the "Open IntelliShell" option. Then run this command: 
 
`db.createUser({user: "root", pwd: 'password', roles: ["readWrite", {role: "readWrite", db: "landuseplanning"}]})`

If this command runs successfully, you should now be able to connect to the DB with the LUP API. You can run `npm start` with the API and begin developing.