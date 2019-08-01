# How to Configure Mongo Database Backup Cronjob and Restore From it

The OpenShift template that we are currently using to run our mongo database backups is ```mongodb-backup.yaml``` in this directory.

## How to Create a Mongo Database Backup Cronjob

Note that the template assumes there is a service called ```mongodb-eagle``` that is exposes the ```mongodb-eagle``` deployment's pod locally. The template also relies on some OpenShift secrets and config maps that will need to be created.

### Through the OpenShift UI or otherwise, you should to create:

OpenShift secret named ```eagle-mongo-secrets``` with key:
```
MONGODB_EAGLE_ADMIN_PASSWORD
```
that is the password for your mongo admin account on your live database

OpenShift config map named ```mongo-config``` with keys:
```
MONGO_BACKUP_COUNT
```
that is the number of backups you want to keep in your PVC
```
MONGO_BACKUP_SIZE_LOWER_LIMIT
```
that is the lower size limit in bytes that your backups should be above to consider them successful
```
MONGO_BACKUP_SIZE_UPPER_LIMIT
```
that is the upper size limit in bytes that your backups should be above to consider them successful
```
ROCKETCHAT_BACKUP_DB_WEBHOOK
```
that is the rocketchat webhook for your backup alert channel

### To create the cronjob:

Copy the login command from the OpenShift UI and paste it into your console

Navigate to your project:

```
oc project <your project>
```

cd into this directory (or wherever your mongodb-backup.yaml file is)

Create the cronjob:

```
oc process -f mongodb-backup.yaml MONGODB_BACKUP_VOLUME_CLAIM=<your PVC> MONGODB_BACKUP_SCHEDULE='30 6 * * *' | oc create -f -
```

where ```MONGODB_BACKUP_VOLUME_CLAIM``` is the PVC that your backups will be sored in and ```MONGODB_BACKUP_SCHEDULE``` is the cron schedule that this job will run on (30 6 * * * is every day at 6:30 AM UCT which is 11:30 PM PCT)

## How to Restore a Mongo Database

### Mount your backup PVC

mount your backup PVC to a container so that you can access your backups. I use PVC migrator in this example (https://github.com/BCDevOps/StorageMigration/tree/master/openshift/templates) but you can use anything with a mount point. there should be a build of PVC migrator in the tools namespace so you should just have to deploy it in your working namespace from there.

In the OpenShift UI, on the deployments page click "Add to Project" then "Import YAML/ JSON" and paste the deployment config in there (https://raw.githubusercontent.com/BCDevOps/StorageMigration/master/openshift/templates/pvc-migrator-deploy.yaml). Input the correct values, deploy and spin up a pod.

### Copy your dump onto your Mongo pod

After you have mounted your mongo backup PVC to a container and spun up a pod, you can copy your backup onto the mongo pod and restore from there.

First figure out which is the last healthy backup and copy that file name (e.g. dump-20190708194109UTC-HEALTHY). To do this, rsh into the pod you just created and look in the mount path (/source in this example).


copy your dump locally using rsync
```
oc rsync <backup pod>:/<mount directory>/<healthy backup folder> .
```
e.g.
```
oc rsync pvc-migrator-2-b7tf5:/source/dump-20190708194109UTC-HEALTHY .
```

cd into your dump directory

```
cd /dump-20190708194109UTC-HEALTHY
```

copy your dump to your pod in the tmp directory

```
oc rsync ./esm/ <mongo db pod>:/tmp/dump/
```
e.g.
```
oc rsync ./esm/ mongodb-17-fs8th:/tmp/dump/
```

### Restore your database

rsh onto your mongo pod

```
oc rsh <mongo pod name>
```

cd to where your dump is

```
cd /tmp
```

drop your database

```
mongo admin -u admin -p $MONGODB_ADMIN_PASSWORD
```

```
show dbs
```

```
use <database name>
```

```
db.dropDatabase()
```

```
exit
```

restore your databse

```
mongorestore -d esm dump/esm/ -u admin -p $MONGODB_ADMIN_PASSWORD --authenticationDatabase=admin
```

check that everything is working properly
