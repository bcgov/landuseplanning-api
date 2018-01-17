"use strict";

var _           = require('lodash');
var mongoose    = require('mongoose');

exports.buildQuery = function (property, values, query) {
    var oids = [];
    _.each(values, function (i) {
      oids.push(mongoose.Types.ObjectId(i));
    });
    return _.assignIn(query, { [property]: {
        $in: oids
      } 
    });
};