# How to Configure Mongo Database Backup Cronjob and Restore From it

The OpenShift template that we are currently using to run our mongo database backups is ```backup-cron.yaml``` in this directory.
This is based on the backup-container common component: https://developer.gov.bc.ca/Backup-Container 

## How to Create a Mongo Database Backup Cronjob

Note that the template assumes there is a service called ```landuseplanning-api-mongodb``` that is exposes the ```landuseplanning-api-mongodb``` deployment's pod locally. The template also relies on some OpenShift secrets and config maps that will need to be created.

### Through the OpenShift UI or otherwise, you should to create:

OpenShift secret named ```artifactory-creds``` (documentation for artifactory found here: https://developer.gov.bc.ca/Artifact-Repositories-(Artifactory) )


OpenShift config map named ```backup-lup-conf``` using the ```backup-configmap.yaml``` file in this directory.

Two PVCs (one for backups, one for verification) using the ```backup-pvc.yaml``` and ```verification-pvc.yaml```


### To create the cronjob:

Log in through the UI, and navigate to Workloads->CronJobs.

Create a new CronJob using the ```backup-cron.yaml``` file in this directory, making any changes as required for your environment.

The cron has been set to run daily at 0 9 * * * (9am UTC, 1am PST)

## How to Restore a Mongo Database
(these are old insstructions from a previous version of the backups, but should still apply)

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
