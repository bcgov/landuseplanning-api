const express = require('express');
const _ = require('lodash');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const DEFAULT_SEARCH_PARAMS = {
  currentPage: { value: 1 },
  pageSize: { value: 1000 },
  // filtering toggles
  isDeleted: { value: false },
  // publish flags
  isPublished: { value: undefined },
  // tag-related
  tags: { value: undefined },
  // domain-specific filters
  _commentPeriod: { value: undefined },
  CommentId: { value: undefined },
  // field selection
  fields: undefined,
  // text search
  keyword: { value: undefined },
};

function defaultProtectedParams(fieldNames, username = null) {
  return {
    auth_payload: {
      scopes: ['sysadmin', 'public'],
      preferred_username: username || 'idir\\test_user',
    },
    fields: { value: _.cloneDeep(fieldNames) },
  };
}

function defaultPublicParams(fieldNames) {
  return {
    fields: { value: _.cloneDeep(fieldNames) },
  };
}

function mergeSwaggerParams(baseParams, additionalValues = {}) {
  const normalizedAdditional = {};
  _.forEach(additionalValues, (v, k) => {
    normalizedAdditional[k] = _.has(v, 'value') ? v : { value: v };
  });

  return _.merge({}, DEFAULT_SEARCH_PARAMS, baseParams, normalizedAdditional);
}

function createSwaggerParams(
  fieldNames,
  additionalValues = {},
  username = null,
) {
  const params = mergeSwaggerParams(
    defaultProtectedParams(fieldNames, username),
    additionalValues,
  );
  return {
    swagger: {
      params: params,
      operation: {
        'x-security-scopes': ['sysadmin', 'public'],
      },
    },
  };
}

function createPublicSwaggerParams(fieldNames, additionalValues = {}) {
  let defaultParams = defaultPublicParams(fieldNames);
  let swaggerObject = {
    swagger: {
      params: _.merge(defaultParams, additionalValues),
    },
  };
  return swaggerObject;
}

function buildParams(nameValueMapping) {
  const paramObj = {};
  _.mapKeys(nameValueMapping, (value, key) => {
    paramObj[key] = { value };
  });
  return paramObj;
}

exports.createSwaggerParams = createSwaggerParams;
exports.createPublicSwaggerParams = createPublicSwaggerParams;
exports.buildParams = buildParams;
exports.app = app;
