"use strict";

var _               = require('lodash');
var mongoose        = require('mongoose');
var clamav          = require('clamav.js');
var fs              = require('fs');
var _serviceHost    = process.env.CLAMAV_SERVICE_HOST || '127.0.0.1';
var _servicePort    = process.env.CLAMAV_SERVICE_PORT || '3310';

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