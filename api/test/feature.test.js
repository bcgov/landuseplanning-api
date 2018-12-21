const test_helper = require('./test_helper');
const app = test_helper.app;
const applicationFactory = require('./factories/application_factory').factory;
const featureFactory = require('./factories/feature_factory').factory;
const mongoose = require('mongoose');
const request = require('supertest');
const _ = require('lodash');

const featureController = require('../controllers/feature.js');
require('../helpers/models/feature');
require('../helpers/models/application');
const Feature = mongoose.model('Feature');

const fieldNames = ['tags', 'properties', 'applicationID'];

function paramsWithFeatureId(req) {
  let params = test_helper.buildParams({'featureId': req.params.id});
  return test_helper.createSwaggerParams(fieldNames, params);
}

function publicParamsWithFeatureId(req) {
  let params = test_helper.buildParams({'featureId': req.params.id});
  return test_helper.createPublicSwaggerParams(fieldNames, params);
}

app.get('/api/feature', function(req, res) {
  let fields = {
    'applicationId': req.query.applicationId
  }
  if (req.query.tantalisId) {
    fields['tantalisId'] = _.toInteger(req.query.tantalisId)
  }

  let extraFields = test_helper.buildParams(fields);
  let params = test_helper.createSwaggerParams(fieldNames, extraFields);
  return featureController.protectedGet(params, res);
});

app.get('/api/feature/:id', function(req, res) {
  return featureController.protectedGet(paramsWithFeatureId(req), res);
});

app.get('/api/public/feature', function(req, res) {
  let fields = {
    'applicationId': req.query.applicationId
  }
  if (req.query.tantalisId) {
    fields['tantalisId'] = _.toInteger(req.query.tantalisId)
  }

  let extraFields = test_helper.buildParams(fields);
  let params = test_helper.createPublicSwaggerParams(fieldNames, extraFields);
  return featureController.publicGet(params, res);
});

app.get('/api/public/feature/:id', function(req, res) {
  return featureController.publicGet(publicParamsWithFeatureId(req), res);
});

app.delete('/api/feature/:id', function(req, res) {
  return featureController.protectedDelete(paramsWithFeatureId(req), res);
});

app.delete('/api/feature/', function(req, res) {
  let extraFields = test_helper.buildParams({'applicationID': req.query.applicationID});
  let params = test_helper.createSwaggerParams(fieldNames, extraFields);
  return featureController.protectedDelete(params, res);
});

app.post('/api/feature/', function(req, res) {
  let extraFields = test_helper.buildParams({'feature': req.body});
  let params = test_helper.createSwaggerParams(fieldNames, extraFields);
  return featureController.protectedPost(params, res);
});

app.put('/api/feature/:id', function(req, res) {
  let extraFields = test_helper.buildParams({'featureId': req.params.id, 'FeatureObject': req.body});
  let params = test_helper.createSwaggerParams(fieldNames, extraFields);
  return featureController.protectedPut(params, res);
});

app.put('/api/feature/:id/publish', function(req, res) {
  return featureController.protectedPublish(paramsWithFeatureId(req), res);
});

app.put('/api/feature/:id/unpublish', function(req, res) {
  return featureController.protectedUnPublish(paramsWithFeatureId(req), res);
});

const applicationsData = [
  {name: 'Special Application', tags: [['public'], ['sysadmin']], isDeleted: false},
  {name: 'Vanilla Ice Cream', tags: [['public']], isDeleted: false},
  {name: 'Confidential Application', tags: [['sysadmin']], isDeleted: false},
  {name: 'Deleted Application', tags: [['public'], ['sysadmin']], isDeleted: true},
];

let specialApplicationId,
  vanillaApplicationId,
  topSecretApplicationId,
  deletedApplicationId;


function setupApplications(applicationsData) {
  return new Promise(function(resolve, reject) {
    applicationFactory.createMany('application', applicationsData).then(applicationArray => {
      resolve(applicationArray);
    }).catch(error => {
      reject(error);
    });
  });
};

function setupFeatures() {
  let featureData = buildFeaturesData();
  return new Promise(function(resolve, reject) {
    featureFactory.createMany('feature', featureData).then(featuresArray => {
      resolve(featuresArray);
    }).catch(error => {
      reject(error);
    })
  });
};

function buildFeaturesData() {
  return [
    {
      applicationID: specialApplicationId,
      properties: {
        TENURE_STATUS: "ACCEPTED",
        TENURE_LOCATION: "1012 Douglas St",
        DISPOSITION_TRANSACTION_SID: 222222,
      },
      tags: [['public'], ['sysadmin']],
      isDeleted: false
    },
    {
      applicationID: vanillaApplicationId,
      properties: {
        TENURE_STATUS: "ACCEPTED",
        TENURE_LOCATION: "Beacon Hill Ice Cream",
        DISPOSITION_TRANSACTION_SID: 333333,
      },
      tags: [['public']],
      isDeleted: false
    },
    {
      applicationID: topSecretApplicationId,
      properties: {
        TENURE_STATUS: "ACCEPTED",
        TENURE_LOCATION: "Pacific Naval Fleet",
        DISPOSITION_TRANSACTION_SID: 444444,
      },
      tags: [['sysadmin']],
      isDeleted: false
    },
    {
      applicationID: deletedApplicationId,
      properties: {
        TENURE_STATUS: "ACCEPTED",
        TENURE_LOCATION: "Torn down Govt Building",
        DISPOSITION_TRANSACTION_SID: 555555,
      },
      tags: [['public'], ['sysadmin']],
      isDeleted: true
    },
  ]
}

beforeEach(done => {
  setupApplications(applicationsData).then((applicationsArray) => {
    specialApplicationId = applicationsArray[0]._id;
    vanillaApplicationId = applicationsArray[1]._id;
    topSecretApplicationId = applicationsArray[2]._id;
    deletedApplicationId = applicationsArray[3]._id;
    done();
  });
});

describe('GET /feature', () => {
  test('returns a list of non-deleted, public and sysadmin features', done => {
    setupFeatures().then((documents) => {
      request(app).get('/api/feature')
        .expect(200)
        .then(response => {
          expect(response.body.length).toEqual(3);

          let firstFeature = _.find(response.body, {applicationID: specialApplicationId.toString()});
          expect(firstFeature._id).not.toBeNull();

          expect(firstFeature).toHaveProperty('properties');
          let firstFeatureProps = firstFeature.properties
          expect(firstFeatureProps.DISPOSITION_TRANSACTION_SID).toBe(222222);
          expect(firstFeatureProps.TENURE_LOCATION).toBe("1012 Douglas St");

          let secondFeature = _.find(response.body, {applicationID: vanillaApplicationId.toString()})
          let secondFeatureProps = secondFeature.properties
          expect(secondFeatureProps.DISPOSITION_TRANSACTION_SID).toBe(333333);
          expect(secondFeatureProps.TENURE_LOCATION).toBe("Beacon Hill Ice Cream");

          let secretFeature = _.find(response.body, {applicationID: topSecretApplicationId.toString()})
          let secretFeatureProps = secretFeature.properties
          expect(secretFeatureProps.DISPOSITION_TRANSACTION_SID).toBe(444444);
          expect(secretFeatureProps.TENURE_LOCATION).toBe('Pacific Naval Fleet');

          done()
        });
    });
  });

  test('does not return tags', done => {
    setupFeatures().then((documents) => {
      request(app).get('/api/feature')
        .expect(200)
        .then(response => {
          let firstFeature = response.body[0];
          expect(firstFeature).not.toHaveProperty('tags');
          done();
        });
    });
  });

  test('can search based on tantalisId', done => {
    setupFeatures().then((documents) => {
      request(app).get('/api/feature')
        .query({tantalisId: 333333})
        .expect(200)
        .then(response => {
          expect(response.body.length).toBe(1);
          let firstFeature = response.body[0];
          expect(firstFeature).not.toHaveProperty('tags');
          expect(firstFeature._id).not.toBeNull();
          done();
        });
    });
  });

  test('can search based on applicationId', done => {
    setupFeatures().then((documents) => {
      expect(specialApplicationId).not.toBeNull();
      expect(specialApplicationId).not.toBeUndefined();
      request(app)
        .get('/api/feature')
        .query({applicationId: specialApplicationId.toString()})
        .expect(200)
        .then(response => {
          expect(response.body.length).toBe(1);
          let firstFeature = response.body[0];
          expect(firstFeature).not.toHaveProperty('tags');
          done();
        });
    });
  });

  test('returns an empty array when there are no Features', done => {
    request(app).get('/api/feature')
      .expect(200)
      .then(response => {
        expect(response.body.length).toBe(0);
        expect(response.body).toEqual([]);
        done();
      });
  });

  describe.skip('searching based on coordinates', () => {
    test.skip('it finds a feature from passed in coordinates', () => {});
    test.skip('it returns 400 if the coordinates are malformed', () => {});
  });
});

describe('GET /feature/{id}', () => {
  test('returns a single feature ', done => {
    setupFeatures().then((documents) => {
      Feature.findOne({applicationID: specialApplicationId}).exec(function(error, feature) {
        expect(feature).not.toBeNull();
        let specialFeatureId = feature._id.toString();
        let uri = '/api/feature/' + specialFeatureId;

        request(app)
          .get(uri)
          .expect(200)
          .then(response => {
            expect(response.body.length).toBe(1);
            let responseObject = response.body[0];
            expect(responseObject).toMatchObject({
              '_id': specialFeatureId,
              'properties': expect.objectContaining({
                'TENURE_STATUS': "ACCEPTED",
                'TENURE_LOCATION': "1012 Douglas St",
                'DISPOSITION_TRANSACTION_SID': 222222,
              })
            });
            done();
          });
      });;
    });
  });


  test.skip('404s if the feature does not exist', done => {
    let uri = '/api/feature/' + 'NON_EXISTENT_ID';
    request(app).get(uri)
      .expect(404)
      .expect(500)
      .then(done);
  });
});

describe('GET /public/feature', () => {
  test('returns a list of public features', done => {
    setupFeatures().then((documents) => {
      request(app).get('/api/public/feature')
        .expect(200)
        .then(response => {
          expect(response.body.length).toEqual(2);

          let firstFeature = _.find(response.body, {applicationID: specialApplicationId.toString()});
          expect(firstFeature).toHaveProperty('_id');

          expect(firstFeature).toHaveProperty('properties');
          let firstFeatureProps = firstFeature.properties
          expect(firstFeatureProps.DISPOSITION_TRANSACTION_SID).toBe(222222);
          expect(firstFeatureProps.TENURE_LOCATION).toBe("1012 Douglas St");

          let secondFeature = _.find(response.body, {applicationID: vanillaApplicationId.toString()});
          let secondFeatureProps = secondFeature.properties
          expect(secondFeatureProps.DISPOSITION_TRANSACTION_SID).toBe(333333);
          expect(secondFeatureProps.TENURE_LOCATION).toBe("Beacon Hill Ice Cream");

          done()
        });
    });
  });

  test('returns an empty array when there are no features', done => {
    request(app).get('/api/public/feature')
      .expect(200)
      .then(response => {
        expect(response.body.length).toBe(0);
        expect(response.body).toEqual([]);
        done();
      });
  });

  test('can search based on tantalisId', done => {
    setupFeatures().then((documents) => {
      request(app).get('/api/public/feature')
        .query({tantalisId: 333333})
        .expect(200)
        .then(response => {
          expect(response.body.length).toBe(1);
          let firstFeature = response.body[0];
          expect(firstFeature).not.toHaveProperty('tags');
          expect(firstFeature._id).not.toBeNull();
          done();
        });
    });
  });

  test('can search based on applicationId', done => {
    setupFeatures().then((documents) => {
      expect(specialApplicationId).not.toBeNull();
      expect(specialApplicationId).not.toBeUndefined();
      request(app)
        .get('/api/public/feature')
        .query({applicationId: specialApplicationId.toString()})
        .expect(200)
        .then(response => {
          console.log(response.body);
          expect(response.body.length).toBe(1);
          let firstFeature = response.body[0];
          expect(firstFeature).not.toHaveProperty('tags');
          done();
        });
    });
  });

  test.skip('allows pagination', done => {

  });
});

describe('GET /public/feature/{id}', () => {
  test('returns a single public feature ', done => {
    setupFeatures().then((documents) => {
      Feature.findOne({applicationID: specialApplicationId}).exec(function(error, feature) {
        let specialFeatureId = feature._id.toString();
        let uri = '/api/public/feature/' + specialFeatureId;

        request(app)
          .get(uri)
          .expect(200)
          .then(response => {
            expect(response.body.length).toBe(1);
            let responseObj = response.body[0];
            expect(responseObj).toMatchObject({
              '_id': specialFeatureId,
              'properties': expect.objectContaining({
                'TENURE_STATUS': "ACCEPTED",
                'TENURE_LOCATION': "1012 Douglas St",
                'DISPOSITION_TRANSACTION_SID': 222222,
              })
            });
            done();
          });
      });;
    });
  });
});

describe('DELETE /feature/{id}', () => {
  test('It HARD deletes an feature', done => {
    setupFeatures().then((documents) => {
      Feature.findOne({applicationID: vanillaApplicationId}).exec(function(error, feature) {
        let vanillaFeatureId = feature._id.toString();
        let uri = '/api/feature/' + vanillaFeatureId;
        request(app)
          .delete(uri)
          .expect(200)
          .then(response => {
            Feature.findOne({applicationID: vanillaApplicationId}).exec(function(error, feature) {
              expect(feature).toBeNull();
              done();
            });
          });
      });
    });
  });

  test('It can delete by application id', done => {
    setupFeatures().then((documents) => {
      let uri = '/api/feature';
      request(app)
        .delete(uri)
        .query({applicationID: vanillaApplicationId.toString()})
        .expect(200)
        .then(response => {
          Feature.findOne({applicationID: vanillaApplicationId}).exec(function(error, feature) {
            expect(feature).toBeNull();
            done();
          });
        });
    });
  });


  test('returns a 400 if no keys are sent', done => {
    setupFeatures().then((documents) => {
      let uri = '/api/feature';
      request(app)
        .delete(uri)
        .query({})
        .expect(400)
        .then(response => {
          expect(response.body).toBe("Can't delete entire collection.");
          done();

        });
    });
  });
  //currently 500s when deleting a non-existent feature
  test.skip('404s if the feature does not exist', done => {
    let uri = '/api/feature/' + 'NON_EXISTENT_ID';
    request(app)
      .delete(uri)
      .expect(404)
      .then(response => {
        console.log(response)
        done();
      });
  });
});

describe('POST /feature', () => {
  let newApplicationData = {code: 'NEW_APP', name: 'Fun Application', tags: [['public'], ['sysadmin']], isDeleted: false};
  let newApplicationId;
  beforeEach(done => {
    setupApplications([newApplicationData]).then((applicationsArray) => {
      newApplicationId = applicationsArray[0].id;
      done();
    });
  });

  test('creates a new feature', done => {
    let featureObj = {
      applicationID: newApplicationId,
      properties: {
        DISPOSITION_TRANSACTION_SID: 888888,
        TENURE_STATUS: "ACCEPTED",
        TENURE_LOCATION: "2975 Jutland Rd",
      }
    };
    request(app).post('/api/feature')
      .send(featureObj)
      .expect(200).then(response => {
        expect(response.body).toHaveProperty('_id');
        Feature.findById(response.body['_id']).exec(function(error, feature) {
          expect(feature).not.toBeNull();
          expect(feature.applicationID.toString()).toBe(newApplicationId.toString());

          expect(feature).toHaveProperty('properties');
          let featureProperties = feature.properties;
          expect(featureProperties.DISPOSITION_TRANSACTION_SID).toEqual(888888);
          expect(featureProperties.TENURE_STATUS).toEqual('ACCEPTED');
          expect(featureProperties.TENURE_LOCATION).toEqual("2975 Jutland Rd");

          done();
        });
      });
  });

  test('sets tags to public and sysadmin by default', done => {
    let featureObj = {
      applicationID: newApplicationId,
      properties: {
        DISPOSITION_TRANSACTION_SID: 888888,
        TENURE_STATUS: "ACCEPTED",
        TENURE_LOCATION: "2975 Jutland Rd",
      }
    };
    request(app).post('/api/feature')
      .send(featureObj)
      .expect(200).then(response => {
        expect(response.body).toHaveProperty('_id');
        Feature.findById(response.body['_id']).exec(function(error, feature) {
          expect(feature).not.toBeNull();

          expect(feature.tags.length).toEqual(2);
          expect(feature.tags[0]).toEqual(expect.arrayContaining(['sysadmin']));
          expect(feature.tags[1]).toEqual(expect.arrayContaining(['public']));

          done();
        });
      });
  });
});

describe('PUT /feature/:id', () => {
  let existingApplicationData = {code: 'NEW_APP', name: 'Old old application', tags: [['public'], ['sysadmin']], isDeleted: false};
  let existingApplicationId;

  beforeEach(done => {
    setupApplications([existingApplicationData]).then((applicationsArray) => {
      existingApplicationId = applicationsArray[0].id;
      done();
    });
  });

  test('updates an feature', done => {
    let featureData = {
      applicationID: existingApplicationId,
      properties: {
        DISPOSITION_TRANSACTION_SID: 999999,
        TENURE_STATUS: "ACCEPTED",
        TENURE_LOCATION: "Freshiis Smelly Food",
      }
    };
    let updateData = {
      properties: {
        TENURE_STATUS: "REJECTED",
        TENURE_LOCATION: 'Qualcomm Second Floor'
      }
    };

    featureFactory.create('feature', featureData).then(featureObj => {
      let uri = '/api/feature/' + featureObj._id;
      request(app).put(uri)
        .send(updateData)
        .then(response => {
          Feature.findOne({applicationID: existingApplicationId}).exec(function(error, feature) {
            expect(feature).not.toBeNull();
            expect(feature.properties).not.toBeNull()
            expect(feature.properties.TENURE_STATUS).toBe('REJECTED')
            expect(feature.properties.TENURE_LOCATION).toBe('Qualcomm Second Floor')
            done();
          });
        });
    });
  });

  test('404s if the feature does not exist', done => {
    let uri = '/api/feature/' + 'NON_EXISTENT_ID';
    request(app).put(uri)
      .send({properties: {'I_AM': 'hacker_man'}})
      .expect(404)
      .then(response => {
        done();
      });
  });

  test('does not allow updating tags', done => {
    let featureData = {
      applicationID: existingApplicationId,
      tags: [['public']]
    };

    let updateData = {
      tags: [['public'], ['sysadmin']]
    };
    featureFactory.create('feature', featureData).then(feature => {
      let uri = '/api/feature/' + feature._id;
      request(app).put(uri)
        .send(updateData)
        .then(response => {
          Feature.findById(feature._id).exec(function(error, updatedFeature) {
            expect(updatedFeature.tags.length).toEqual(1)
            done();
          });
        });
    });
  });
});

describe('PUT /application/:id/publish', () => {
  let existingApplicationId;
  beforeEach(done => {
    setupApplications([{code: 'NEW_APP'}]).then((applicationsArray) => {
      existingApplicationId = applicationsArray[0].id;
      done();
    });
  });

  test('publishes a feature', done => {
    let unpublishedFeatureData = {
      applicationID: existingApplicationId,
      tags: []
    }
    featureFactory.create('feature', unpublishedFeatureData).then(feature => {
      let uri = '/api/feature/' + feature._id + '/publish';
      request(app).put(uri)
        .expect(200)
        .send({})
        .then(response => {
          Feature.findById(feature._id).exec(function(error, updatedFeature) {
            expect(updatedFeature).toBeDefined();
            expect(updatedFeature).not.toBeNull();
            expect(updatedFeature.tags[0]).toEqual(expect.arrayContaining(['public']));
            done();
          });
        });
    });
  });

  test('404s if the feature does not exist', done => {
    let uri = '/api/feature/' + 'NON_EXISTENT_ID' + '/publish';
    request(app).put(uri)
      .send({})
      .expect(404)
      .then(response => {
        done();
      });
  });
});

describe('PUT /feature/:id/unpublish', () => {
  let existingApplicationId;

  beforeEach(done => {
    setupApplications([{code: 'EXISTING_APP'}]).then((applicationsArray) => {
      existingApplicationId = applicationsArray[0].id;
      done();
    });
  });

  test('unpublishes a feature', done => {
    let publicFeatureData = {
      applicationID: existingApplicationId,
      tags: [['public']]
    };

    featureFactory.create('feature', publicFeatureData).then(feature => {
      let uri = '/api/feature/' + feature._id + '/unpublish';
      request(app).put(uri)
        .expect(200)
        .send({})
        .then(response => {
          Feature.findById(feature.id).exec(function(error, updatedFeature) {
            expect(updatedFeature).toBeDefined();
            expect(updatedFeature.tags[0]).toEqual(expect.arrayContaining([]));
            done();
          });
        });
    });
  });

  test('404s if the feature does not exist', done => {
    let uri = '/api/feature/' + 'NON_EXISTENT_ID' + '/unpublish';
    request(app).put(uri)
      .send({})
      .expect(404)
      .then(response => {
        done();
      });
  });
});