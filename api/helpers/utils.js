"use strict";

var _               = require('lodash');
var mongoose        = require('mongoose');
var clamav          = require('clamav.js');
var fs              = require('fs');
var _serviceHost    = process.env.CLAMAV_SERVICE_HOST || '127.0.0.1';
var _servicePort    = process.env.CLAMAV_SERVICE_PORT || '3310';
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

exports.runDataQuery = function (modelType, role, query, fields, sortWarmUp, sort, skip, limit, count) {
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

        theModel.aggregate(aggregations)
        .exec()
        .then(resolve, reject);
    });
};
