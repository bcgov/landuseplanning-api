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


## Upgrading from older versions

If you are using a version of landuseplanning-api in your local environment that was created previous to 2026, you will have to upgrade your packages and database.

Database Backup (optional):

1. Start your existing containerization platform (Colima, Podman, Rancher, etc)
2. Run `docker compose -f docker-compose.mongo36.yaml up` in this directory.
3. Verify the container is running with `docker ps`
4. Shell into the container with `docker exec -it <mongo36-container-name> bash`
5. Perform a mongodump from within the virtual env `mongodump --db <dbname> --out /dump`
6. Copy the files back to your local drive `docker cp <mongo36-container-name>:/dump ./mongodump-36`

Create New Container

7. Install a compatible containerization platform: Podman is suggested
    - If using Podman, follow the setup wizard on first start to setup a linux environment
    - Make sure other utilities like Colima, Podman, Rancher are stopped/exited
8. Start Podman in the cli `podman machine start`
9. Create a Mongo 6 container: `podman run -d --name mongo6 -p 27017:27017 -v mongo6data:/data/db mongo:6`
10. Verify that it exists `podman ps`

Restore data (optional)

11. Copy the files into the podman container `podman cp ./mongodump-36 mongo6:/tmp/mongodump`
12. Shell into podman container `podman exec -it mongo6 bash`
13. Perform mongorestore `mongorestore --db <dbname> --drop /tmp/mongodump/<dbname>`

Update Packages

14. Remove the package-lock.json and node_modules folder in the main directory `rm -rf node_modules package-lock.json`
15. Make sure you are using Node version 18
16. Perform an `npm install`