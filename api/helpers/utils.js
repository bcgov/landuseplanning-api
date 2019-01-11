"use strict";

var _               = require('lodash');
var mongoose        = require('mongoose');
var clamav          = require('clamav.js');
var fs              = require('fs');
var request         = require('request');
var turf            = require('@turf/turf');
var helpers         = require('@turf/helpers');
var Wkt             = require('wicket');
var _serviceHost    = process.env.CLAMAV_SERVICE_HOST || '127.0.0.1';
var _servicePort    = process.env.CLAMAV_SERVICE_PORT || '3310';
var _tantalisAPI    = process.env.TTLS_API_ENDPOINT || "https://api.nrs.gov.bc.ca/ttls-api/v1/";
var webADEAPI       = process.env.WEBADE_AUTH_ENDPOINT || "https://api.nrs.gov.bc.ca/oauth2/v1/";
var username        = process.env.WEBADE_USERNAME || "TTLS-EXT";
var password        = process.env.WEBADE_PASSWORD || "x";
var MAX_LIMIT       = 1000;

var DEFAULT_PAGESIZE  = 100;

exports.buildQuery = function (property, values, query) {
    var oids = [];
    if (_.isArray(values)) {
        _.each(values, function (i) {
          oids.push(mongoose.Types.ObjectId(i));
        });
    } else {
        oids.push(mongoose.Types.ObjectId(values));
    }
    return _.assignIn(query, { [property]: {
        $in: oids
      } 
    });
};

// MBL: TODO Make this event driven instead of synchronous?
exports.avScan = function (buffer) {
    return new Promise(function (resolve, reject) {
        var stream = require('stream');
        // Initiate the source
        var bufferStream = new stream.PassThrough();
        // Write your buffer
        bufferStream.end(buffer);

        clamav.ping(_servicePort, _serviceHost, 1000, function(err) {
            if (err) {
                console.log('ClamAV service: ' + _serviceHost + ':' + _servicePort + ' is not available['+err+']');
                resolve(false);
            } else {
                console.log('ClamAV service is alive: ' + _serviceHost + ':' + _servicePort);
                clamav.createScanner(_servicePort, _serviceHost)
                .scan(bufferStream, function(err, object, malicious) {
                    if (err) {
                        console.log(err);
                        resolve(false);
                    }
                    else if (malicious) {
                        console.log('Malicious object FOUND');
                        resolve(false);
                    }
                    else {
                        console.log('Virus scan OK');
                        resolve(true);
                    }
                });
            }
          });
    });
}

exports.getSkipLimitParameters = function (pageSize, pageNum) {
    const params = {};

    var ps = DEFAULT_PAGESIZE; // Default
    if (pageSize && pageSize.value !== undefined) {
      if (pageSize.value > 0) {
        ps = pageSize.value;
      }
    }
    if (pageNum && pageNum.value !== undefined) {
      if (pageNum.value >= 0) {
        params.skip = (pageNum.value * ps);
        params.limit = ps;
      }
    }
    return params;
};

exports.runDataQuery = function (modelType, role, query, fields, sortWarmUp, sort, skip, limit, count, preQueryPipelineSteps) {
    return new Promise(function (resolve, reject) {
        var theModel = mongoose.model(modelType);
        var projection = {};

        // Don't project unecessary fields if we are only counting objects.
        if (count) {
            projection._id = 1;
            projection.tags = 1;
        } else {
            // Fields we always return
            var defaultFields = ['_id',
                                'code',
                                'tags'];
            _.each(defaultFields, function (f) {
                projection[f] = 1;
            });
        
            // Add requested fields - sanitize first by including only those that we can/want to return
            _.each(fields, function (f) {
                projection[f] = 1;
            });
        }

        var aggregations = _.compact([
        {
            "$match": query
        },
        {
            "$project": projection
        },
        {
            $redact: {
                $cond: {
                    if: {
                        $anyElementTrue: {
                            $map: {
                                input: "$tags" ,
                                as: "fieldTag",
                                in: { $setIsSubset: [ "$$fieldTag", role ] }
                            }
                        }
                    },
                    then: "$$DESCEND",
                    else: "$$PRUNE"
                }
            }
        },
        
        sortWarmUp, // Used to setup the sort if a temporary projection is needed.
        
        !_.isEmpty(sort) ? { $sort: sort } : null,

        sort ? { $project: projection } : null, // Reset the projection just in case the sortWarmUp changed it.

        // Do this only if they ask for it.
        count && {
            $group: {
                _id: null,
                total_items : { $sum : 1 }
            }
        },
        { $skip: skip || 0 },
        { $limit: limit || MAX_LIMIT }
        ]);

        // Pre-pend the aggregation with other pipeline steps if we are joining on another datasource
        if (preQueryPipelineSteps && preQueryPipelineSteps.length > 0) {
            for (let step of preQueryPipelineSteps) {
                aggregations.unshift(step);
            }
        }

        theModel.aggregate(aggregations)
        .exec()
        .then(resolve, reject);
    });
};

// WebADE Login
exports.loginWebADE = function () {
    // Login to webADE and return access_token for use in subsequent calls.
    return new Promise(function (resolve, reject) {
      request({ url: webADEAPI + "oauth/token?grant_type=client_credentials&disableDeveloperFilter=true",
                headers : {
                    "Authorization" : "Basic " + new Buffer(username + ":" + password).toString("base64")
                }
      }, function (err, res, body) {
        if (err || (res && res.statusCode !== 200)) {
          reject(err);
        } else {
          try {
            var obj = JSON.parse(body);
            if (obj && obj.access_token) {
              resolve(obj.access_token);
            } else {
              reject();
            }
          } catch (e) {
            reject(e);
          }
        }
      });
    });
};

// Tantalis API
exports.getApplicationByFilenumber = function (accessToken, clFile) {
    return new Promise(function (resolve, reject) {
        console.log("Looking up file:", _tantalisAPI + "landUseApplications?fileNumber=" + clFile);
        request({
            url: _tantalisAPI + "landUseApplications?fileNumber=" + clFile,
            auth: {
                bearer: accessToken
            }
        },
        function (err, res, body) {
            if (err || (res && res.statusCode !== 200)) {
                console.log("TTLS API ResponseCode:", err == null ? res.statusCode : err);
                reject(err);
            } else {
                try {
                    var obj = JSON.parse(body);
                    // console.log("obj:", obj);
                    var applications = [];
                    if (obj && obj.elements && obj.elements.length > 0) {
                        // console.log("obj.elements:", obj.elements);
                        for(let app of obj.elements) {
                            // console.log("app:", app);
                            var application = {};
                            application.TENURE_PURPOSE                  = app.purposeCode['description'];
                            application.TENURE_SUBPURPOSE               = app.purposeCode.subPurposeCodes[0]['description'];
                            application.TENURE_TYPE                     = app.landUseTypeCode['description'];
                            application.TENURE_SUBTYPE                  = app.landUseTypeCode.landUseSubTypeCodes[0]['description'];
                            application.TENURE_STATUS                   = app.statusCode['description'];
                            application.TENURE_STAGE                    = app.stageCode['description'];
                            application.TENURE_LOCATION                 = app.locationDescription;
                            application.RESPONSIBLE_BUSINESS_UNIT       = app.businessUnit.name;
                            application.CROWN_LANDS_FILE                = app.fileNumber;
                            application.DISPOSITION_TRANSACTION_SID     = app.landUseApplicationId;
                            applications.push(application);
                        }
                    } else {
                        console.log("No results found.");
                    }
                    resolve(applications);
                } catch (e) {
                    console.log("Object Parsing Failed:", e);
                    reject(e);
                }
            }
        });
    });
};

exports.getApplicationByDispositionID = function (accessToken, disp) {
    return new Promise(function (resolve, reject) {
        console.log("Looking up disposition:", _tantalisAPI + "landUseApplications/" + disp);
        request({
            url: _tantalisAPI + "landUseApplications/" + disp,
            auth: {
                bearer: accessToken
            }
        },
        function (err, res, body) {
            if (err || (res && res.statusCode !== 200)) {
                console.log("TTLS API ResponseCode:", err == null ? res.statusCode : err);
                if (!err && res && res.statusCode) {
                    err = {};
                    err.statusCode = res.statusCode;
                }
                reject(err);
            } else {
                try {
                    var obj = JSON.parse(body);
                    var application = {};
                    if (obj) {
                        // Setup the application object.
                        application.TENURE_PURPOSE                  = obj.purposeCode['description'];
                        application.TENURE_SUBPURPOSE               = obj.purposeCode.subPurposeCodes[0]['description'];
                        application.TENURE_TYPE                     = obj.landUseTypeCode['description'];
                        application.TENURE_SUBTYPE                  = obj.landUseTypeCode.landUseSubTypeCodes[0]['description'];
                        application.TENURE_STATUS                   = obj.statusCode['description'];
                        application.TENURE_STAGE                    = obj.stageCode['description'];
                        application.TENURE_LOCATION                 = obj.locationDescription;
                        application.RESPONSIBLE_BUSINESS_UNIT       = obj.businessUnit.name;
                        application.CROWN_LANDS_FILE                = obj.fileNumber;
                        application.DISPOSITION_TRANSACTION_SID     = disp;
                        application.parcels                         = [];
                        application.interestedParties               = [];
                        application.statusHistoryEffectiveDate      = (obj.statusHistory[0] != null) ?
                                                                      new Date(obj.statusHistory[0].effectiveDate) : // convert Unix Epoch Time (ms)
                                                                      null;

                        // WKT conversion to GEOJSON
                        for (let geo of obj.interestParcels) {

                            var repro = null;
                            if (geo.wktGeometry) {
                                // convert to geojson
                                var wkt = new Wkt.Wkt();
                                wkt.read(geo.wktGeometry);
                                var geometry = wkt.toJson();

                                var epsg        = require('epsg');
                                var reproject   = require('reproject');

                                // Convert for use in leaflet coords.
                                repro       = reproject.toWgs84(geometry, 'EPSG:3005', epsg);
                                var feature = {};
                                feature.TENURE_LEGAL_DESCRIPTION    = geo.legalDescription;
                                feature.TENURE_AREA_IN_HECTARES     = geo.areaInHectares;
                                feature.INTRID_SID                  = geo.interestParcelId;
                                feature.FEATURE_CODE                = geo.featureCode;
                                feature.FEATURE_AREA_SQM            = geo.areaInSquareMetres;
                                feature.FEATURE_LENGTH_M            = geo.areaLengthInMetres;
                                feature.TENURE_EXPIRY               = geo.expiryDate;

                                var crs             = {};
                                crs.properties      = {};
                                crs.properties.name = "urn:ogc:def:crs:EPSG::4326";

                                application.parcels.push({
                                    type: "Feature",
                                    geometry: repro,
                                    properties: feature,
                                    crs: crs
                                });
                            }
                        }

                        // Calculate areaHectares, prepare centroid calculation
                        var centroids = helpers.featureCollection([]);
                        application.areaHectares = 0.00;
                        _.each(application.parcels, function (f) {
                            // Get the polygon and put it for later centroid calculation
                            if (f.geometry) {
                                centroids.features.push(turf.centroid(f));
                            }
                            if (f.properties && f.properties.TENURE_AREA_IN_HECTARES) {
                                application.areaHectares += parseFloat(f.properties.TENURE_AREA_IN_HECTARES);
                            }
                        });
                        // Centroid of all the shapes.
                        if (centroids.features.length > 0) {
                            application.centroid = turf.centroid(centroids).geometry.coordinates;
                        }

                        // Interested Parties
                        for (let party of obj.interestedParties) {
                            var partyObj = {};
                            partyObj.interestedPartyType = party.interestedPartyType;

                            if (party.interestedPartyType == 'I') {
                                partyObj.firstName = party.individual.firstName;
                                partyObj.lastName = party.individual.lastName;
                            } else {
                                // party.interestedPartyType == 'O'
                                partyObj.legalName = party.organization.legalName;
                                partyObj.divisionBranch = party.organization.divisionBranch;
                            }
                            // Check if we've already added this.
                            if (!_.includes(application.interestedParties, partyObj)) {
                                application.interestedParties.push(partyObj);
                            }
                        }
                        resolve(application);
                    } else {
                        console.log("Nothing found.");
                        resolve(null);
                    }
                } catch (e) {
                    console.log("Object Parsing Failed:", e);
                    reject(e);
                }
            }
        });
    });
};