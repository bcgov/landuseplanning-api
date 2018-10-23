const test_helper = require('./test_helper');
const applicationFactory = require('./factories/application_factory').factory;
const app = test_helper.app;
const mongoose = require('mongoose');
const request = require('supertest');
const nock = require('nock');
const tantalisResponse = require('./fixtures/tantalis_response.json');
const fieldNames = ['description', 'tantalisID'];
const _ = require('lodash');


const applicationController = require('../controllers/application.js');
require('../helpers/models/application');
require('../helpers/models/feature');
const Application = mongoose.model('Application');
const Feature = mongoose.model('Feature');
const idirUsername = 'idir/i_am_a_bot';

function paramsWithAppId(req) {
  let params = test_helper.buildParams({'appId': req.params.id});
  return test_helper.createSwaggerParams(fieldNames, params);
}

function publicParamsWithAppId(req) {
  let params = test_helper.buildParams({'appId': req.params.id});
  return test_helper.createPublicSwaggerParams(fieldNames, params);
}

app.get('/api/application', function(req, res) {
  let swaggerParams = test_helper.createSwaggerParams(fieldNames);
  return applicationController.protectedGet(swaggerParams, res);
});

app.get('/api/application/:id', function(req, res) {
  return applicationController.protectedGet(paramsWithAppId(req), res);
});

app.get('/api/public/application', function(req, res) {
  let publicSwaggerParams = test_helper.createPublicSwaggerParams(fieldNames);
  return applicationController.publicGet(publicSwaggerParams, res);
});

app.get('/api/public/application/:id', function(req, res) {
  return applicationController.publicGet(publicParamsWithAppId(req), res);
});

app.post('/api/application/', function(req, res) {
  let extraFields = test_helper.buildParams({'app': req.body});
  let params = test_helper.createSwaggerParams(fieldNames, extraFields, idirUsername);
  return applicationController.protectedPost(params, res);
});

app.delete('/api/application/:id', function(req, res) {
  return applicationController.protectedDelete(paramsWithAppId(req), res);
});

app.put('/api/application/:id', function(req, res) {
  let extraFields = test_helper.buildParams({'appId': req.params.id, 'AppObject': req.body});
  let params = test_helper.createSwaggerParams(fieldNames, extraFields);
  return applicationController.protectedPut(params, res);
});

app.put('/api/application/:id/publish', function(req, res) {
  return applicationController.protectedPublish(paramsWithAppId(req), res);
});

app.put('/api/application/:id/unpublish', function(req, res) {
  return applicationController.protectedUnPublish(paramsWithAppId(req), res);
});

const applicationsData = [
  {description: 'SPECIAL', name: 'Special Application', tags: [['public'], ['sysadmin']], isDeleted: false},
  {description: 'VANILLA', name: 'Vanilla Ice Cream', tags: [['public']], isDeleted: false},
  {description: 'TOP_SECRET', name: 'Confidential Application', tags: [['sysadmin']], isDeleted: false},
  {description: 'DELETED', name: 'Deleted Application', tags: [['public'], ['sysadmin']], isDeleted: true},
];


function setupApplications(applicationsData) {
  return new Promise(function(resolve, reject) {
    applicationFactory.createMany('application', applicationsData).then(applicationArray => {
      resolve(applicationArray);
    }).catch(error => {
      reject(error);
    });
  });
};

describe('GET /application', () => {
  test('returns a list of non-deleted, public and sysadmin Applications', done => {
    setupApplications(applicationsData).then((documents) => {
      request(app).get('/api/application')
        .expect(200)
        .then(response => {
          expect(response.body.length).toEqual(3);
          
          let firstApplication = _.find(response.body, {description: 'SPECIAL'});
          expect(firstApplication).toHaveProperty('_id');
          expect(firstApplication['tags']).toEqual(expect.arrayContaining([["public"], ["sysadmin"]]));

          let secondApplication = _.find(response.body, {description: 'VANILLA'});
          expect(secondApplication).toHaveProperty('_id');
          expect(secondApplication['tags']).toEqual(expect.arrayContaining([["public"]]));

          let secretApplication = _.find(response.body, {description: 'TOP_SECRET'});
          expect(secretApplication).toHaveProperty('_id');
          expect(secretApplication['tags']).toEqual(expect.arrayContaining([["sysadmin"]]));
          done()
        });
    });
  });

  test('returns an empty array when there are no Applications', done => {
    request(app).get('/api/application')
      .expect(200)
      .then(response => {
        expect(response.body.length).toBe(0);
        expect(response.body).toEqual([]);
        done();
      });
  });

  describe('pagination', () => {
    test.skip('it paginates when pageSize is present', () => {});
    test.skip('it paginates when pageNum is present', () => {});
  });
});

describe('GET /application/{id}', () => {
  test('returns a single Application ', done => {
    setupApplications(applicationsData).then((documents) => {
      Application.findOne({description: 'SPECIAL'}).exec(function(error, application) {
        let specialAppId = application._id.toString();
        let uri = '/api/application/' + specialAppId;

        request(app)
          .get(uri)
          .expect(200)
          .then(response => {
            expect(response.body.length).toBe(1);
            let responseObject = response.body[0];
            expect(responseObject).toMatchObject({
              '_id': specialAppId,
              'tags': expect.arrayContaining([['public'], ['sysadmin']]),
              description: 'SPECIAL'
            });
            done();
          });
      });;
    });
  });
});

describe('GET /public/application', () => {
  test('returns a list of public Applications', done => {
    setupApplications(applicationsData).then((documents) => {
      request(app).get('/api/public/application')
        .expect(200)
        .then(response => {
          expect(response.body.length).toEqual(2);

          let firstApplication = _.find(response.body, {description: 'SPECIAL'});
          expect(firstApplication).toHaveProperty('_id');
          expect(firstApplication['tags']).toEqual(expect.arrayContaining([["public"], ["sysadmin"]]));

          let secondApplication = _.find(response.body, {description: 'VANILLA'});
          expect(secondApplication).toHaveProperty('_id');
          expect(secondApplication.description).toBe('VANILLA');
          expect(secondApplication['tags']).toEqual(expect.arrayContaining([["public"]]));
          done()
        });
    });
  });

  test('returns an empty array when there are no Applications', done => {
    request(app).get('/api/public/application')
      .expect(200)
      .then(response => {
        expect(response.body.length).toBe(0);
        expect(response.body).toEqual([]);
        done();
      });
  });
});

describe('GET /public/application/{id}', () => {
  test('returns a single public application ', done => {
    setupApplications(applicationsData).then((documents) => {
      Application.findOne({description: 'SPECIAL'}).exec(function(error, application) {
        let specialAppId = application._id.toString();
        let uri = '/api/public/application/' + specialAppId;

        request(app)
          .get(uri)
          .expect(200)
          .then(response => {
            expect(response.body.length).toBe(1);
            let responseObj = response.body[0];
            expect(responseObj).toMatchObject({
              '_id': specialAppId,
              'tags': expect.arrayContaining([['public'], ['sysadmin']]),
              description: 'SPECIAL'
            });
            done();
          });
      });;
    });
  });
});

describe('DELETE /application/id', () => {
  test('It soft deletes an application', done => {
    setupApplications(applicationsData).then((documents) => {
      Application.findOne({description: 'VANILLA'}).exec(function(error, application) {
        let vanillaAppId = application._id.toString();
        let uri = '/api/application/' + vanillaAppId;
        request(app)
          .delete(uri)
          .expect(200)
          .then(response => {
            Application.findOne({description: 'VANILLA'}).exec(function(error, application) {
              expect(application.isDeleted).toBe(true);
              done();
            });
          });
      });
    });
  });

  test('404s if the application does not exist', done => {
    let uri = '/api/application/' + 'NON_EXISTENT_ID';
    request(app)
      .delete(uri)
      .expect(404)
      .then(response => {
        done();
      });
  });
});

describe.skip('POST /application', () => {

  const bcgwDomain = 'https://openmaps.gov.bc.ca';
  const searchPath = '/geo/pub/WHSE_TANTALIS.TA_CROWN_TENURES_SVW/ows?service=wfs&version=2.0.0&request=getfeature&typename=PUB:WHSE_TANTALIS.TA_CROWN_TENURES_SVW&outputFormat=json&srsName=EPSG:4326&CQL_FILTER=DISPOSITION_TRANSACTION_SID=';
  let applicationObj = {
    name: 'Victoria',
    description: 'victoria',
    tantalisID: 999999
  };
  const bcgw = nock(bcgwDomain);
  let urlEncodedTantalisId = `%27${applicationObj.tantalisID}%27`;

  describe('when bcgw finds a matching object', () => {
    beforeEach(() => {
      return bcgw.get(searchPath + urlEncodedTantalisId)
        .reply(200, tantalisResponse);
    });

    test('creates a new application', done => {
      request(app).post('/api/application')
        .send(applicationObj)
        .expect(200).then(response => {
          expect(response.body).toHaveProperty('_id');
          Application.findOne({description: 'victoria'}).exec(function(error, application) {
            expect(application).toBeDefined();
            expect(application.name).toBe('Victoria');
            done();
          });
        });
    });

    test('sets geographical properties', done => {
      request(app).post('/api/application')
        .send(applicationObj)
        .expect(200).then(response => {
          expect(response.body).toHaveProperty('_id');
          Application.findById(response.body['_id']).exec(function(error, application) {
            expect(application.areaHectares).not.toBeNull();
            expect(application.areaHectares).toBeGreaterThan(1);

            expect(application.centroid).toBeDefined();
            expect(application.centroid.length).toBe(2);

            done();
          });
        });
    });

    test('it sets the _addedBy to the person creating the application', done => {
      request(app).post('/api/application')
        .send(applicationObj)
        .expect(200).then(response => {
          expect(response.body).toHaveProperty('_id');
          Application.findOne({description: 'victoria'}).exec(function(error, application) {
            expect(application).not.toBeNull();
            expect(application._addedBy).not.toBeNull();
            expect(application._addedBy).toEqual(idirUsername);
            done();
          });
        });
    });

    test('defaults to sysadmin for tags and review tags', done => {
      request(app).post('/api/application')
        .send(applicationObj)
        .expect(200).then(response => {
          expect(response.body).toHaveProperty('_id');
          Application.findById(response.body['_id']).exec(function(error, application) {
            expect(application).not.toBeNull();

            expect(application.tags.length).toEqual(1)
            expect(application.tags[0]).toEqual(expect.arrayContaining(['sysadmin']));

            done();
          });
        });
    });

    test('saves features on the application', done => {
      request(app).post('/api/application')
        .send(applicationObj)
        .expect(200).then(response => {
          expect(response.body).toHaveProperty('_id');
          Feature.findOne({applicationID: response.body['_id']}).exec(function(error, feature) {
            expect(feature).not.toBeNull();
            expect(feature.INTRID_SID).not.toBeNull();
            done();
          });
        });
    });
  });

  describe('when bcgw returns an error response', () => {
    beforeEach(() => {
      return bcgw.get(searchPath + urlEncodedTantalisId)
        .reply(500, {"error": "Something went wrong"});
    });

    test.skip('throws 500 when an error is caught', done => {

      request(app).post('/api/application')
        .send(applicationObj)
        .expect(500)
        .catch(errorResponse => {
          done();
        });
    });

    test.skip('handles a 404 correctly', done => {
      done();
    });
  });
});

describe('PUT /application/:id', () => {
  test('updates an application', done => {
    let existingApplication = new Application({
      description: 'SOME_APP',
      name: 'Boring Application'
    });
    let updateData = {
      name: 'Exciting Application'
    };
    existingApplication.save().then(application => {
      let uri = '/api/application/' + application._id;
      request(app).put(uri)
        .send(updateData)
        .then(response => {
          Application.findOne({name: 'Exciting Application'}).exec(function(error, application) {
            expect(application).toBeDefined();
            expect(application).not.toBeNull();
            done();
          });
        });
    });
  });

  test('404s if the application does not exist', done => {
    let uri = '/api/application/' + 'NON_EXISTENT_ID';
    request(app).put(uri)
      .send({name: 'hacker_man'})
      .expect(404)
      .then(response => {
        done();
      });
  });

  test('does not allow updating tags', done => {
    let existingApplication = new Application({
      description: 'EXISTING',
      tags: [['public']]
    });
    let updateData = {
      tags: [['public'], ['sysadmin']]
    };
    existingApplication.save().then(application => {
      let uri = '/api/application/' + application._id;
      request(app).put(uri)
        .send(updateData)
        .then(response => {
          Application.findById(existingApplication._id).exec(function(error, updatedApplication) {
            expect(updatedApplication.tags.length).toEqual(1)
            done();
          });
        });
    });
  });
});

describe('PUT /application/:id/publish', () => {
  let existingApplication;
  beforeEach(() => {
    existingApplication = new Application({
      description: 'Existing',
      name: 'Boring application',
    });
    return existingApplication.save();
  });

  test('publishes an application', done => {
    let uri = '/api/application/' + existingApplication._id + '/publish';
    request(app).put(uri)
      .expect(200)
      .send({})
      .then(response => {
        Application.findById(existingApplication._id).exec(function(error, application) {
          expect(application).toBeDefined();
          expect(application).not.toBeNull();
          expect(application.tags[0]).toEqual(expect.arrayContaining(['public']));
          done();
        });
      });
  });

  test('404s if the application does not exist', done => {
    let uri = '/api/application/' + 'NON_EXISTENT_ID' + '/publish';
    request(app).put(uri)
      .send({})
      .expect(404)
      .then(response => {
        done();
      });
  });

  test('handles feature publish', done => {
    let applicationFeature = new Feature({
      tags: [],
      applicationID: existingApplication._id
    });
    applicationFeature.save().then(appFeature => {
      let uri = '/api/application/' + existingApplication._id + '/publish';
      request(app).put(uri)
        .expect(200)
        .send({})
        .then(response => {
          Feature.findById(appFeature._id).exec(function(error, feature) {
            expect(feature).not.toBeNull();
            expect(feature.tags[0]).toEqual(expect.arrayContaining(['public']));
            done();
          });
        });
    });
  });
});

describe('PUT /application/:id/unpublish', () => {
  let existingApplication;
  beforeEach(() => {
    existingApplication = new Application({
      description: 'Existing',
      name: 'Boring application',
      tags: [['public']]
    });
    return existingApplication.save();
  });

  test('unpublishes an application', done => {
    let uri = '/api/application/' + existingApplication._id + '/unpublish';
    request(app).put(uri)
      .expect(200)
      .send({})
      .then(response => {
        Application.findById(existingApplication._id).exec(function(error, application) {
          expect(application).toBeDefined();
          expect(application.tags[0]).toEqual(expect.arrayContaining([]));
          done();
        });
      });
  });

  test('404s if the application does not exist', done => {
    let uri = '/api/application/' + 'NON_EXISTENT_ID' + '/unpublish';
    request(app).put(uri)
      .send({})
      .expect(404)
      .then(response => {
        done();
      });
  });

  test('handles feature unpublish', done => {
    let applicationFeature = new Feature({
      tags: [],
      applicationID: existingApplication._id,
      tags: [['public']]
    });

    applicationFeature.save().then(appFeature => {
      let uri = '/api/application/' + existingApplication._id + '/unpublish';
      request(app).put(uri)
        .expect(200)
        .send({})
        .then(response => {
          Feature.findById(appFeature._id).exec(function(error, feature) {
            expect(feature).not.toBeNull();
            expect(feature.tags[0]).toEqual(expect.arrayContaining([]));
            done();
          });
        });
    });
  });
});