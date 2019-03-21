var mongoose = require('mongoose');
const defaultLog = require('winston').loggers.get('default');
var _ = require('lodash');

/**
 * Generates the mongoose model schema for the given definition.
 *
 * @param {string} name model name
 * @param {*} definition model definition
 * @returns mongoose schema
 */
var genSchema = function(name, definition) {
  // model properties
  let indexes = [];

  // parse out model properties
  _.forEach(definition, function(value, key) {
    if (key.substr(0, 2) === '__') {
      delete definition[key];

      switch (key.substr(2)) {
        case 'index':
          indexes.push(value);
          break;
      }
    }
  });

  // schema options
  const options = {
    usePushEach: true //https://github.com/Automattic/mongoose/issues/5870
  };

  // create schema
  var schema = new mongoose.Schema(definition, options);

  // add model properties - post schema creation
  if (indexes && indexes.length) {
    _.forEach(indexes, function(value) {
      schema.index(value);
    });
  }

  return schema;
};

/**
 * Generates the mongoose based on the given definition.
 *
 * @param {string} name name of the model
 * @param {Object} definition model definition
 * @returns mongoose model
 */
module.exports = function(name, definition) {
  if (!name || !definition) {
    defaultLog.error('No name or definition supplied when building schema');
    return;
  }
  return mongoose.model(name, genSchema(name, definition));
};
