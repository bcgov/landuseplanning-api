const test_helper = require('./test_helper');
const app = test_helper.app;
const mongoose = require('mongoose');
const request = require('supertest');
const nock = require('nock');
const arcGisResponse = require('./fixtures/arcgis_response.json');
const crownlandsResponse = require('./fixtures/crownlands_response.json');
const tantalisResponse = require('./fixtures/tantalis_response.json');
const fieldNames = [];
const Utils = require('../helpers/utils');

const _ = require('lodash');

function publicParamsWithDtId(req) {
  let params = test_helper.buildParams({'dtId': req.params.id});
  return test_helper.createPublicSwaggerParams(fieldNames, params);
}

const searchController = require('../controllers/search.js');
require('../helpers/models/application');
require('../helpers/models/feature');
const Application = mongoose.model('Application');
const Feature = mongoose.model('Feature');


app.get('/api/search/ttlsapi/crownLandFileNumber/:id', function(req, res) {
  let extraFields = test_helper.buildParams({'fileNumber': req.params.id});
  let params = test_helper.createSwaggerParams(fieldNames, extraFields);
  return searchController.protectedTTLSGetApplicationsByFileNumber(params, res);
});

app.get('/api/search/ttlsapi/dispositionTransactionId/:id', function(req, res) {
  let extraFields = test_helper.buildParams({'dtId': req.params.id});
  let params = test_helper.createSwaggerParams(fieldNames, extraFields);
  return searchController.protectedTTLSGetApplicationByDisp(params, res);
});

app.get('/api/public/search/bcgw/getClientsInfoByDispositionId/:id', function(req, res) {
  return searchController.publicGetClientsInfoByDispositionId(publicParamsWithDtId(req), res);
});

app.get('/api/public/search/bcgw/crownLandsId/:id', function(req, res) {
  let extraFields = test_helper.buildParams({'crownLandsId': req.params.id});
  let params = test_helper.createSwaggerParams(fieldNames, extraFields);
  return searchController.publicGetBCGW(params, res);
});

app.get('/api/public/search/dispositionTransactionId/:id', function(req, res) {
  return searchController.publicGetDispositionTransactionId(publicParamsWithDtId(req), res);
});

app.get('/api/public/search/bcgw/dispositionTransactionId/:id', function(req, res) {
  return searchController.publicGetBCGWDispositionTransactionId(publicParamsWithDtId(req), res);
});

describe('GET /api/search/ttlsapi/crownLandFileNumber/', () => {
  let clFileNumber = 555555;
  const firstResult = {DISPOSITION_TRANSACTION_SID: 111111};
  const secondResult = {DISPOSITION_TRANSACTION_SID: 222222};
  const dispSearchResult = {};

  describe('when the ttls api login call returns successfully', () => {
    let loginPromise = new Promise(function(resolve, reject) {
      resolve('ACCESS_TOKEN');
    });

    let appFileNumSearchPromise = new Promise(function(resolve, reject) {
      resolve([firstResult, secondResult]);
    });

    let appDispSearchPromise = new Promise(function(resolve, reject) {
      resolve(dispSearchResult);
    });

    beforeEach(() => {
      spyOn(Utils, 'loginWebADE').and.returnValue(loginPromise);

      spyOn(Utils, 'getApplicationByFilenumber')
        .and.returnValue(appFileNumSearchPromise);

      spyOn(Utils, 'getApplicationByDispositionID')
        .and.returnValue(appDispSearchPromise);
    });

    test('logs in and then searches TTLS by CLFileNumber with that access token', done => {
      request(app).get('/api/search/ttlsapi/crownLandFileNumber/' + clFileNumber)
        .expect(200)
        .then(response => {
          expect(Utils.loginWebADE).toHaveBeenCalled();
          expect(Utils.getApplicationByFilenumber).toHaveBeenCalledWith('ACCESS_TOKEN', '555555');
          done();
        });
    });

    test('searches TTLS getApplicationByDispositionID once for each disp returned by the file number search', done => {
      request(app).get('/api/search/ttlsapi/crownLandFileNumber/' + clFileNumber)
        .expect(200)
        .then(response => {
          expect(Utils.getApplicationByFilenumber).toHaveBeenCalledWith('ACCESS_TOKEN', '555555');

          expect(Utils.getApplicationByDispositionID).toHaveBeenCalledWith('ACCESS_TOKEN', 111111);
          expect(Utils.getApplicationByDispositionID).toHaveBeenCalledWith('ACCESS_TOKEN', 222222);

          done();
        });
    });

    test('returns the search results from each getAppliationByDispositionID call', done => {
      request(app).get('/api/search/ttlsapi/crownLandFileNumber/' + clFileNumber)
        .expect(200)
        .then(response => {
          expect(response.body.length).toEqual(2);
          expect(response.body).toEqual([dispSearchResult, dispSearchResult])

          done();
        });
    });

  });

  describe('when the ttls api login call fails', () => {
    let loginPromise = new Promise(function(resolve, reject) {
      reject({statusCode: 503, message: 'Ooh boy something went wrong'});
    });

    beforeEach(() => {
      spyOn(Utils, 'loginWebADE').and.returnValue(loginPromise);
    });

    test('returns that error response', done => {
      request(app).get('/api/search/ttlsapi/crownLandFileNumber/' + clFileNumber)
        .expect(503)
        .then(response => {
          expect(response.body.message).toEqual('Ooh boy something went wrong');
          done();
        });
    });
  });
});

describe('GET /api/search/ttlsapi/dispositionTransactionId/', () => {
  let dispositionId = 666666;
  const searchResult = {
    DISPOSITION_TRANSACTION_SID: 666666
  };

  describe('when the ttls api login call returns successfully', () => {
    let loginPromise = new Promise(function(resolve, reject) {
      resolve('ACCESS_TOKEN');
    });

    let appDispSearchPromise = new Promise(function(resolve, reject) {
      resolve(searchResult);
    });

    beforeEach(() => {
      spyOn(Utils, 'loginWebADE')
        .and.returnValue(loginPromise);

      spyOn(Utils, 'getApplicationByDispositionID')
        .and.returnValue(appDispSearchPromise);
    });

    test('logs in and then retrieves the application with that access token', done => {
      request(app).get('/api/search/ttlsapi/dispositionTransactionId/' + dispositionId)
        .expect(200)
        .then(response => {
          expect(Utils.loginWebADE).toHaveBeenCalled();
          expect(Utils.getApplicationByDispositionID).toHaveBeenCalledWith('ACCESS_TOKEN', '666666');
          done();
        });
    });
  });

  describe('when the ttls api login call fails', () => {
    let loginPromise = new Promise(function(resolve, reject) {
      reject({statusCode: 503, message: 'Ooh boy something went wrong'});
    });

    beforeEach(() => {
      spyOn(Utils, 'loginWebADE').and.returnValue(loginPromise);
    });

    test('returns that error response', done => {
      request(app).get('/api/search/ttlsapi/dispositionTransactionId/' + dispositionId)
        .expect(503)
        .then(response => {
          expect(response.body.message).toEqual('Ooh boy something went wrong');
          done();
        });
    });
  });
});

describe('GET /api/public/search/bcgw/getClientsInfoByDispositionId', () => {
  const arcGisDomain = 'http://maps.gov.bc.ca/';
  const searchPath = '/arcgis/rest/services/mpcm/bcgw/MapServer/dynamicLayer/query?layer=%7B%22id%22%3A1%2C%22source%22%3A%7B%22type%22%3A%22dataLayer%22%2C%22dataSource%22%3A%7B%22type%22%3A%22table%22%2C%22workspaceId%22%3A%22MPCM_ALL_PUB%22%2C%22dataSourceName%22%3A%22WHSE_TANTALIS.TA_INTEREST_HOLDER_VW%22%7D%7D%7D&text=&objectIds=&time=&geometry=&geometryType=esriGeometryEnvelope&inSR=&spatialRel=esriSpatialRelIntersects&relationParam=&outFields=*&returnGeometry=true&maxAllowableOffset=&outSR=&returnIdsOnly=false&returnCountOnly=false&orderByFields=&groupByFieldsForStatistics=&outStatistics=&returnZ=false&returnM=false&returnDistinctValues=false&f=json&where=DISPOSITION_TRANSACTION_SID=';
  const argGis = nock(arcGisDomain);
  let dispositionId = 666666;
  let urlEncodedDispositionId = `%27${dispositionId}%27`;

  describe('When the arcgis call returns successfully', () => {
    beforeEach(() => {
      argGis.get(searchPath + urlEncodedDispositionId)
        .reply(200, arcGisResponse);
    });

    test('returns the features data from the search', done => {
      request(app).get('/api/public/search/bcgw/getClientsInfoByDispositionId/' + dispositionId)
        .expect(200).then(response => {
          expect(response.body.length).toBe(2);
          let firstFeature = response.body[0];
          expect(firstFeature).toHaveProperty('DISPOSITION_TRANSACTION_SID');
          expect(firstFeature).toHaveProperty('CITY');
          expect(firstFeature).toHaveProperty('INTERESTED_PARTY_SID');
          done();
        });
    });
  });

  describe('When the arcgis call returns with an error', () => {
    let arcGisErrorResponse = {
      msg: 'Beep boop, something went wrong'
    };
    beforeEach(() => {
      argGis.get(searchPath + urlEncodedDispositionId)
        .reply(400, arcGisErrorResponse);
    });

    test('returns a 400 if the arcgis response status is not 200', done => {
      request(app).get('/api/public/search/bcgw/getClientsInfoByDispositionId/' + dispositionId)
        .expect(400)
        .then(response => {
          expect(response.body).toEqual("400 {\"msg\":\"Beep boop, something went wrong\"}")
          done();
        });
    });
  });

  describe('when the arcgis call returns 200, but error in body', () => {
    let arcGisErrorResponse = {
      "error": {
        "code": 400,
        "message": "Invalid or missing input parameters.",
        "details": []
      }
    };

    beforeEach(() => {
      argGis.get(searchPath + urlEncodedDispositionId)
        .reply(200, arcGisErrorResponse);
    });

    // TODO: shouldn't this test read more like: 'returns a 400 if the arcgis response body is unsuccessful'
    // Returns an empty array if response body is invalid
    test('returns an empty array if the arcgis response body is unsuccessful', done => {
      request(app).get('/api/public/search/bcgw/getClientsInfoByDispositionId/' + dispositionId)
        // .expect(400)
        .expect(200)
        .then(response => {
          // expect(response.body).toBe(arcGisErrorResponse);
          expect(response.body).toEqual([]);
          done();
        });
    });
  });
});

describe('GET /api/public/search/bcgw/crownLandsId/ ', () => {
  const bcgwDomain = 'https://openmaps.gov.bc.ca/';
  const searchPath = '/geo/pub/WHSE_TANTALIS.TA_CROWN_TENURES_SVW/ows?service=wfs&version=2.0.0&request=getfeature&typename=PUB:WHSE_TANTALIS.TA_CROWN_TENURES_SVW&outputFormat=json&srsName=EPSG:4326&CQL_FILTER=CROWN_LANDS_FILE=';
  const bcgw = nock(bcgwDomain);
  let crownlandsId = 7777;
  // crownlands id with 7 digits
  let paddedCrownlandsId = `%27000${crownlandsId}%27`;

  describe('when bcgw call is successful', () => {
    beforeEach(() => {
      bcgw.get(searchPath + paddedCrownlandsId)
        .reply(200, crownlandsResponse);
    });

    test('returns the features data from the search', done => {
      request(app).get('/api/public/search/bcgw/crownLandsId/' + crownlandsId)
        .expect(200)
        .then(response => {
          expect(response.body.features).toBeDefined();
          let firstFeature = response.body.features[0];
          expect(firstFeature).toHaveProperty('properties')
          expect(firstFeature.properties).toHaveProperty('DISPOSITION_TRANSACTION_SID');
          expect(firstFeature.properties).toHaveProperty('CROWN_LANDS_FILE');
          expect(firstFeature.properties).toHaveProperty('TENURE_STATUS');
          done();
        });
    });

    test('it adds the SID to the response sidsFound property if there is a matching application in the db', done => {
      let crownlandSID = crownlandsResponse.features[0].properties.DISPOSITION_TRANSACTION_SID;
      let existingApplication = new Application({
        tantalisID: crownlandSID
      });
      existingApplication.save().then(() => {
        request(app).get('/api/public/search/bcgw/crownLandsId/' + crownlandsId)
          .expect(200)
          .then(response => {
            expect(response.body.sidsFound).toBeDefined();
            expect(response.body.sidsFound).toEqual([crownlandSID.toString()]);
            done();
          });
      });
    });
  });

  describe('When the bcgw call returns with an error', () => {
    let bcgwErrorResponse = {
      msg: 'Beep boop, something went wrong'
    };
    beforeEach(() => {
      bcgw.get(searchPath + paddedCrownlandsId)
        .reply(400, bcgwErrorResponse);
    });

    test('returns a 400 if the bcgw response status is not 200', done => {
      request(app).get('/api/public/search/bcgw/crownLandsId/' + crownlandsId)
        .expect(400)
        .then(response => {
          expect(response.body).toEqual("400 {\"msg\":\"Beep boop, something went wrong\"}")
          done();
        });
    });
  });

  describe('when the bcgw call returns 200, but error in body', () => {
    let bcgwErrorResponse = {
      "error": {
        "code": 400,
        "message": "Invalid or missing input parameters.",
        "details": []
      }
    };

    beforeEach(() => {
      bcgw.get(searchPath + paddedCrownlandsId)
        .reply(200, bcgwErrorResponse);
    });

    test('returns an empty array if the arcgis response body is unsuccessful', done => {
      request(app).get('/api/public/search/bcgw/crownLandsId/' + crownlandsId)
        // .expect(400)
        .expect(200)
        .then(response => {
          // expect(response.body).toBe(arcGisErrorResponse);
          expect(response.body).toMatchObject(bcgwErrorResponse);
          done();
        });
    });
  });

});

describe('GET /api/public/search/dispositionTransactionId', () => {
  let dispositionId = 666666;

  test('finds the matching feature in the database', done => {
    let existingFeature = new Feature({
      properties: {
        DISPOSITION_TRANSACTION_SID: dispositionId
      }
    });
    existingFeature.save().then(() => {
      request(app).get('/api/public/search/dispositionTransactionId/' + dispositionId)
        .expect(200)
        .then(response => {

          expect(response.body).toBeDefined();
          expect(response.body).not.toBeNull();
          expect(response.body).toHaveProperty('crs');
          expect(response.body).toHaveProperty('features');
          expect(response.body.features.length).toBe(1);
          expect(response.body.features[0]._id).toBe(existingFeature._id.toString());
          done();
        });
    });
  });
});

describe('GET /api/public/search/bcgw/dispositionTransactionId', () => {
  const bcgwDomain = 'https://openmaps.gov.bc.ca';
  const searchPath = '/geo/pub/WHSE_TANTALIS.TA_CROWN_TENURES_SVW/ows?service=wfs&version=2.0.0&request=getfeature&typename=PUB:WHSE_TANTALIS.TA_CROWN_TENURES_SVW&outputFormat=json&srsName=EPSG:4326&CQL_FILTER=DISPOSITION_TRANSACTION_SID=';
  const bcgw = nock(bcgwDomain);
  let dispositionId = 666666;
  let urlEncodedDispositionId = `%27${dispositionId}%27`;


  describe('When the bcgw call returns successfully', () => {
    beforeEach(() => {
      bcgw.get(searchPath + urlEncodedDispositionId)
        .reply(200, tantalisResponse);
    });

    test('returns the features data from the search', done => {
      request(app).get('/api/public/search/bcgw/dispositionTransactionId/' + dispositionId)
        .expect(200)
        .then(response => {
          let firstFeature = response.body.features[0];
          expect(firstFeature).toHaveProperty('properties')
          expect(firstFeature.properties).toHaveProperty('DISPOSITION_TRANSACTION_SID');
          expect(firstFeature.properties).toHaveProperty('CROWN_LANDS_FILE');
          expect(firstFeature.properties).toHaveProperty('TENURE_STATUS');
          done();
        });
    });

    test('it adds the SID to the response sidsFound property if there is a matching application in the db', done => {
      let dispositionTransactionId = crownlandsResponse.features[0].properties.DISPOSITION_TRANSACTION_SID;
      let existingApplication = new Application({
        tantalisID: dispositionTransactionId
      });
      existingApplication.save().then(() => {
        request(app).get('/api/public/search/bcgw/dispositionTransactionId/' + dispositionId)
          .expect(200)
          .then(response => {
            expect(response.body.sidsFound).toBeDefined();
            expect(response.body.sidsFound).toEqual([dispositionTransactionId.toString()]);
            done();
          });
      });
    });
  });

  describe('When the bcgw call returns with an error', () => {
    let bcgwErrorResponse = {
      msg: 'Beep boop, something went wrong'
    };
    beforeEach(() => {
      return bcgw.get(searchPath + urlEncodedDispositionId)
        .reply(400, bcgwErrorResponse);
    });

    test('returns a 400 if the arcgis response status is not 200', done => {
      request(app).get('/api/public/search/bcgw/dispositionTransactionId/' + dispositionId)
        .expect(400)
        .then(response => {
          expect(response.body).toEqual("400 {\"msg\":\"Beep boop, something went wrong\"}")
          done();
        });
    });
  });

  describe('when the bcgw call returns 200, but error in body', () => {
    let bcgwErrorResponse = {
      "error": {
        "code": 400,
        "message": "Invalid or missing input parameters.",
        "details": []
      }
    };

    beforeEach(() => {
      return bcgw.get(searchPath + urlEncodedDispositionId)
        .reply(200, bcgwErrorResponse);
    });

    // TODO: shouldn't this test read more like: 'returns a 400 if the bcgw response body is unsuccessful'
    test('returns an empty array if the bcgw response body is unsuccessful', done => {
      request(app).get('/api/public/search/bcgw/dispositionTransactionId/' + dispositionId)
        // .expect(400)
        .expect(200)
        .then(response => {
          // expect(response.body).toBe(bcgwErrorResponse);
          expect(response.body).toMatchObject(bcgwErrorResponse);
          done();
        });
    });
  });
});