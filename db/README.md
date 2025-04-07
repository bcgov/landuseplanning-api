# Local Database Setup

Land Use Planning/Planning in Partnership currently uses `mongo 3.6.3`. To install the database locally, run the `docker-compose.yaml` file in this directory.

Once the database is up, it'll be available on port 27017. You'll need to run an additional command to allow the default user to access the `landuseplanning` database.

You can connect to the DB in numerous ways. Since the database version is old, you may need to use an older tool. Studio 3T free is one option. Make sure you use the 2024.4.1 version. Also be sure you use `SCRAM-SHA-1` encryption when connecting. Whichever method you use to connect, you'll need to run:

`db.updateUser("root", {roles: ["readWrite", {role: "readWrite", db: "landuseplanning"}]})`

Once this command runs successfully, the LUP API should now be able to connect to the database.