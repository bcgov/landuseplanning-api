const Utils = require('../../helpers/utils');
const nock = require('nock');
var _ = require('lodash');

describe('utils', () => {
  const nrsApiDomain = 'https://api.nrs.gov.bc.ca';
  const loginPath = '/oauth2/v1/oauth/token?grant_type=client_credentials&disableDeveloperFilter=true';
  const headers = {
    reqheaders: {
      authorization: 'Basic VFRMUy1FWFQ6eA==',
    }
  };

  describe('loginWebADE', () => {
    const nrsApi = nock(nrsApiDomain, headers);
    const webAdeResponse = {
      access_token: 'ACCESS_TOKEN',
      token_type: 'bearer',
      expires_in: 43199
    };

    describe('When the webADE call returns successfully', () => {
      beforeEach(() => {
        nrsApi.get(loginPath)
          .reply(200, webAdeResponse);
      });

      test('returns the access token', done => {
        Utils.loginWebADE()
          .then(response => {
            expect(response).toEqual('ACCESS_TOKEN');
            done();
          });
      });
    });

    describe('When the webADE call returns with a non-200 status code', () => {
      let webADEErrorResponse = {
        msg: 'Beep boop, something went wrong'
      };
      beforeEach(() => {
        nrsApi.get(loginPath)
          .reply(400, webADEErrorResponse);
      });

      test('rejects the promise', done => {
        Utils.loginWebADE()
          .catch(response => {
            done();
          });
      });
    });
  });

  describe('getApplicationByFilenumber', () => {
    const nrsApi = nock(nrsApiDomain);
    const accessToken = 'ACCESS_TOKEN';
    const fileNumber = '99999'

    const fileSearchPath = '/ttls-api/v1/landUseApplications?fileNumber=99999';
    const ttlsApiResponse = {
      "@type": "LandUseApplicationResources",
      "links": [
        {
          "@type": "RelLink",
          "rel": "self",
          "href": "https://api.nrs.gov.bc.ca/ttls-api/v1/landUseApplications?fileNumber=7410005&stage=&status=&type=&purpose=&location=&received=&updated=&pageNumber=1&pageRowCount=1",
          "method": "GET"
        }
      ],
      "pageNumber": 1,
      "pageRowCount": 1,
      "totalRowCount": 1,
      "totalPageCount": 1,
      "elements": [
        {
          "@type": "LandUseApplicationResource",
          "links": [],
          "landUseApplicationId": 777777,
          "clientReferenceNumber": "100246965",
          "receivedDate": 1525417200000,
          "fileNumber": "888888",
          "locationDescription": "Over the River and through the woods",
          "lastUpdated": 1533051208000,
          "stageCode": {
            "@type": "StageCodeResource",
            "links": [],
            "code": "T",
            "description": "TENURE"
          },
          "businessUnit": {
            "@type": "BusinessUnitResource",
            "links": [],
            "id": 7,
            "name": "Super evil corporation"
          },
          "statusCode": {
            "@type": "StatusCodeResource",
            "links": [],
            "code": "GS",
            "description": "DISPOSITION IN GOOD STANDING"
          },
          "landUseTypeCode": {
            "@type": "LandUseTypeCodeResource",
            "links": [],
            "code": "7",
            "description": "Yes, this is the land use type code",
            "landUseSubTypeCodes": [
              {
                "@type": "LandUseSubTypeCodeResource",
                "links": [],
                "code": "2",
                "description": "First land use sub type"
              }
            ]
          },
          "purposeCode": {
            "@type": "PurposeCodeResource",
            "links": [],
            "code": "3",
            "description": "I have a very important purpose in life!",
            "subPurposeCodes": [
              {
                "@type": "SubPurposeCodeResource",
                "links": [],
                "code": "6",
                "description": "This is the first subpurpose description"
              }
            ]
          },
          "documents": [],
          "interestedParties": [],
          "shapes": [],
          "interestParcels": [],
          "statusHistory": [],
          "parkReasonHistory": []
        }
      ]
    };

    describe('When the api call returns successfully', () => {
      beforeEach(() => {
        nrsApi.get(fileSearchPath)
          .reply(200, ttlsApiResponse);
      });

      test('returns an application with the right tenure types and purposes', done => {
        Utils.getApplicationByFilenumber(accessToken, fileNumber)
          .then(response => {
            expect(response.length).toEqual(1);
            let firstApplication = response[0];
            expect(firstApplication.TENURE_PURPOSE).toEqual('I have a very important purpose in life!');
            expect(firstApplication.TENURE_SUBPURPOSE).toEqual('This is the first subpurpose description');
            expect(firstApplication.TENURE_TYPE).toEqual('Yes, this is the land use type code');
            expect(firstApplication.TENURE_SUBTYPE).toEqual('First land use sub type');

            done();
          });
      });

      test('returns an application with the expected tenure status, stage, and location attrs', done => {
        Utils.getApplicationByFilenumber(accessToken, fileNumber)
          .then(response => {
            expect(response.length).toEqual(1);
            let firstApplication = response[0];

            expect(firstApplication.TENURE_STATUS).toEqual('DISPOSITION IN GOOD STANDING');
            expect(firstApplication.TENURE_STAGE).toEqual('TENURE');
            expect(firstApplication.TENURE_LOCATION).toEqual('Over the River and through the woods');

            done();
          });
      });

      test('returns an application with the correct additional attributes', done => {
        Utils.getApplicationByFilenumber(accessToken, fileNumber)
          .then(response => {
            expect(response.length).toEqual(1);
            let firstApplication = response[0];
            expect(firstApplication.RESPONSIBLE_BUSINESS_UNIT).toEqual('Super evil corporation');
            expect(firstApplication.CROWN_LANDS_FILE).toEqual('888888');
            expect(firstApplication.DISPOSITION_TRANSACTION_SID).toEqual(777777);

            done();
          });
      });
    });
  });

  describe('getApplicationByDispositionID', () => {
    const nrsApi = nock(nrsApiDomain);
    const accessToken = 'ACCESS_TOKEN';
    const dispId = '666666'
    const individualPartyObj = {
      "@type": "ApplicationInterestedPartyResource",
      "links": [],
      "interestedPartyId": 293927,
      "interestedPartyType": "I",
      "individual": {
        "firstName": "John",
        "lastName": "Doe"
      }
    };
    const organizationPartyObj = {
      "@type": "ApplicationInterestedPartyResource",
      "links": [],
      "interestedPartyId": 293927,
      "interestedPartyType": "O",
      "individual": null,
      "organization": {
        "divisionBranch": "Brasil Tax Evasion",
        "legalName": "Operation Car Wash"
      }
    };

    const landUseAppSearchPath = '/ttls-api/v1/landUseApplications/666666';
    const ttlsApiResponse = {
      "@type": "LandUseApplicationResource",
      "links": [
        {
          "@type": "RelLink",
          "rel": "self",
          "href": "https://api.nrs.gov.bc.ca/ttls-api/v1/landUseApplications/933249",
          "method": "GET"
        }
      ],
      "landUseApplicationId": 666666,
      "clientReferenceNumber": "100244978",
      "receivedDate": 1525676400000,
      "fileNumber": "888888",
      "locationDescription": "Over the River and through the woods",
      "lastUpdated": 1527878179000,
      "stageCode": {
        "@type": "StageCodeResource",
        "links": [],
        "code": "A",
        "description": "TENURE"
      },
      "businessUnit": {
        "@type": "BusinessUnitResource",
        "links": [],
        "id": 6,
        "name": "Super evil corporation"
      },
      "statusCode": {
        "@type": "StatusCodeResource",
        "links": [],
        "code": "AC",
        "description": "DISPOSITION IN GOOD STANDING"
      },
      "landUseTypeCode": {
        "@type": "LandUseTypeCodeResource",
        "links": [],
        "code": "7",
        "description": "Yes, this is the land use type code",
        "landUseSubTypeCodes": [
          {
            "@type": "LandUseSubTypeCodeResource",
            "links": [],
            "code": "1",
            "description": "First land use sub type"
          }
        ]
      },
      "purposeCode": {
        "@type": "PurposeCodeResource",
        "links": [],
        "code": "3",
        "description": "I have a very important purpose in life!",
        "subPurposeCodes": [
          {
            "@type": "SubPurposeCodeResource",
            "links": [],
            "code": "6",
            "description": "This is the first subpurpose description"
          }
        ]
      },
      "documents": [],
      "interestedParties": [individualPartyObj, organizationPartyObj],
      "shapes": [],
      "interestParcels": [
        {
          "@type": "InterestParcelResource",
          "links": [],
          "interestParcelId": 12345,
          "legalDescription": "READ THESE BORING LEGAL TERMS.",
          "areaCalcCode": "AUTO",
          "areaCalcDescription": "Calculated automatically",
          "areaInHectares": 3.333,
          "expiryDate": 1527878179000,
          "featureCode": "FL98000100",
          "areaInSquareMetres": 33855.6279054274,
          "areaLengthInMetres": 740.122691165678,
          "wktGeometry": "POLYGON ((843405.474983077 1481115.65441351, 843566.561526555 1481059.93430167, 843481.388035521 1480882.29620365, 843313.798870558 1480944.97363803, 843405.474983077 1481115.65441351))"
        }
      ],
      "statusHistory": [
        {
          "@type": "ApplicationStatusResource",
          "links": [],
          "code": "AC",
          "description": "ACCEPTED",
          "effectiveDate": 1527878179000,
          "expiryDate": null
        }
      ],
      "parkReasonHistory": []
    };

    describe('When the api call returns successfully', () => {
      beforeEach(() => {
        nrsApi.get(landUseAppSearchPath)
          .reply(200, ttlsApiResponse);
      });

      test('returns an application with the right tenure types and purposes', done => {
        Utils.getApplicationByDispositionID(accessToken, dispId)
          .then(response => {
            let firstApplication = response;
            expect(firstApplication.TENURE_PURPOSE).toEqual('I have a very important purpose in life!');
            expect(firstApplication.TENURE_SUBPURPOSE).toEqual('This is the first subpurpose description');
            expect(firstApplication.TENURE_TYPE).toEqual('Yes, this is the land use type code');
            expect(firstApplication.TENURE_SUBTYPE).toEqual('First land use sub type');

            done();
          });
      });

      test('returns an application with the expected tenure status, stage, and location attrs', done => {
        Utils.getApplicationByDispositionID(accessToken, dispId)
          .then(response => {
            let firstApplication = response;

            expect(firstApplication.TENURE_STATUS).toEqual('DISPOSITION IN GOOD STANDING');
            expect(firstApplication.TENURE_STAGE).toEqual('TENURE');
            expect(firstApplication.TENURE_LOCATION).toEqual('Over the River and through the woods');

            done();
          });
      });

      test('returns an application with the correct additional attributes', done => {
        Utils.getApplicationByDispositionID(accessToken, dispId)
          .then(response => {
            let firstApplication = response;
            expect(firstApplication.RESPONSIBLE_BUSINESS_UNIT).toEqual('Super evil corporation');
            expect(firstApplication.CROWN_LANDS_FILE).toEqual('888888');
            expect(firstApplication.DISPOSITION_TRANSACTION_SID).toEqual(dispId);

            done();
          });
      });

      test('sets the statusHistoryEffectiveDate', done => {
        Utils.getApplicationByDispositionID(accessToken, dispId)
          .then(response => {
            expect(response.statusHistoryEffectiveDate).toEqual(1527878179000);

            done();
          });
      });

      describe('parcels', () => {

        // TODO: Figure out how to to properly test centroid and areaHectares calculation
        test('sets the areaHectares and centroid properties', done => {
          Utils.getApplicationByDispositionID(accessToken, dispId)
            .then(application => {
              expect(application.areaHectares).toEqual(3.333);
              expect(application.centroid).not.toBeNull();

              done();
            });
        });

        test('it adds parcels to the application', done => {
          Utils.getApplicationByDispositionID(accessToken, dispId)
            .then(application => {
              expect(application.parcels).not.toBeNull();
              expect(application.parcels.length).toEqual(1);
              const firstParcel = application.parcels[0];
              expect(firstParcel.type).toEqual('Feature');

              done();
            });
        });

        test('it sets the feature tenure properties correctly on the parcel', done => {
          Utils.getApplicationByDispositionID(accessToken, dispId)
            .then(application => {
              expect(application.parcels.length).toEqual(1);
              const firstParcel = application.parcels[0];
              const properties = firstParcel.properties;
              expect(properties.TENURE_LEGAL_DESCRIPTION).toEqual('READ THESE BORING LEGAL TERMS.');
              expect(properties.TENURE_AREA_IN_HECTARES).toEqual(3.333);
              expect(properties.INTRID_SID).toEqual(12345);
              expect(properties.TENURE_EXPIRY).toEqual(1527878179000);

              done();
            });
        });

        test('it sets the feature properties correctly on the parcel', done => {
          Utils.getApplicationByDispositionID(accessToken, dispId)
            .then(application => {
              expect(application.parcels.length).toEqual(1);
              const firstParcel = application.parcels[0];
              const properties = firstParcel.properties;

              expect(properties.FEATURE_CODE).toEqual('FL98000100');
              expect(properties.FEATURE_AREA_SQM).toEqual(33855.6279054274);
              expect(properties.FEATURE_LENGTH_M).toEqual(740.122691165678);

              done();
            });
        });

        test('sets the crs properties name', done => {
          Utils.getApplicationByDispositionID(accessToken, dispId)
            .then(application => {
              expect(application.parcels.length).toEqual(1);
              const firstParcel = application.parcels[0];
              const crs = firstParcel.crs;
              expect(crs).not.toBeNull();
              expect(crs.properties.name).toEqual("urn:ogc:def:crs:EPSG::4326");

              done();
            });
        });

        // Not sure how to go about testing this, so I'm just testing that something gets set. 
        test('sets the geometry', done => {
          Utils.getApplicationByDispositionID(accessToken, dispId)
            .then(application => {
              expect(application.parcels.length).toEqual(1);
              const firstParcel = application.parcels[0];
              const geometry = firstParcel.geometry;
              expect(geometry).not.toBeNull();
              expect(geometry.type).toEqual('Polygon');
              expect(geometry.coordinates).toBeDefined();

              done();
            });
        });
      });

      describe('interestedParties', () => {
        describe('with an individual party type object', () => {
          test('it adds the individual party object to the interestedParties array', done => {
            Utils.getApplicationByDispositionID(accessToken, dispId)
              .then(application => {
                expect(application.interestedParties.length).toEqual(2);
                const individualParty = _.find(application.interestedParties, {interestedPartyType: 'I'});
                expect(individualParty.firstName).toEqual('John');
                expect(individualParty.lastName).toEqual('Doe');
                expect(individualParty.interestedPartyType).toEqual('I');

                done();
              });
          });
        });

        describe('with an organization party type object', () => {
          test('it adds the organization party object to the interestedParties array', done => {
            Utils.getApplicationByDispositionID(accessToken, dispId)
              .then(application => {
                expect(application.interestedParties.length).toEqual(2);
                const orgParty = _.find(application.interestedParties, {interestedPartyType: 'O'});
                expect(orgParty.legalName).toEqual('Operation Car Wash');
                expect(orgParty.divisionBranch).toEqual('Brasil Tax Evasion');
                expect(orgParty.interestedPartyType).toEqual('O');

                done();
              });
          });
        });
      });
    });

    describe('when the api call returns with a non-200 status code', () => {
      beforeEach(() => {
        nrsApi.get(landUseAppSearchPath)
          .reply(500, {error: 'something went wrong'});
      });

      test('it rejects with an error object', done => {
        Utils.getApplicationByDispositionID(accessToken, dispId)
          .catch(error => {
            expect(error).not.toBeNull();
            expect(error.statusCode).toEqual(500);

            done();
          });
      });
    });
  });
});
