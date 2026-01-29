'use strict';

const { isArray, assignIn, each, compact, isEmpty } = require('lodash');
const mongoose = require('mongoose');
const clamav = require('clamav.js');
const defaultLog = require('winston').loggers.get('defaultLog');
const _serviceHost = process.env.CLAMAV_SERVICE_HOST || '127.0.0.1';
const _servicePort = process.env.CLAMAV_SERVICE_PORT || '3310';
const MAX_LIMIT = 1000;
const DEFAULT_PAGESIZE = 100;

const getUserProjectPermissions = async (userGuid) => {
  let projectPermissions = [];
  const User = mongoose.model('User');
  const user = await User.findOne({ idirUserGuid: userGuid }).exec();

  if (user && 'projectPermissions' in user) {
    projectPermissions = user.projectPermissions;
  }

  return projectPermissions;
};

exports.getUserProjectPermissions = getUserProjectPermissions;

exports.buildQuery = (property, values, query) => {
  const oids = [];
  if (isArray(values)) {
    each(values, (i) => {
      oids.push(mongoose.Types.ObjectId(i));
    });
  } else {
    oids.push(mongoose.Types.ObjectId(values));
  }
  return assignIn(query, {
    [property]: { $in: oids },
  });
};

// TODO: Make this event-driven instead of synchronous?
exports.avScan = (buffer) => {
  return new Promise((resolve) => {
    const stream = require('stream');
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);

    clamav.ping(_servicePort, _serviceHost, 1000, (err) => {
      if (err) {
        defaultLog.info(
          'ClamAV service: ' +
            _serviceHost +
            ':' +
            _servicePort +
            ' is not available[' +
            err +
            ']'
        );
        return resolve(false);
      }

      defaultLog.info(
        'ClamAV service is alive: ' + _serviceHost + ':' + _servicePort
      );
      clamav
        .createScanner(_servicePort, _serviceHost)
        .scan(bufferStream, (scanErr, object, malicious) => {
          if (scanErr) {
            defaultLog.error(scanErr);
            return resolve(false);
          }
          if (malicious) {
            defaultLog.warn('Malicious object FOUND');
            return resolve(false);
          }
          defaultLog.info('Virus scan OK');
          return resolve(true);
        });
    });
  });
};

exports.getSkipLimitParameters = (pageSize, pageNum) => {
  const params = {};

  let ps = DEFAULT_PAGESIZE; // Default
  if (pageSize && pageSize.value !== undefined) {
    if (pageSize.value > 0) {
      ps = pageSize.value;
    }
  }
  if (pageNum && pageNum.value !== undefined) {
    if (pageNum.value >= 0) {
      params.skip = pageNum.value * ps;
      params.limit = ps;
    }
  }
  return params;
};

exports.recordAction = async (action, meta, payload, objId = null) => {
  const Audit = mongoose.model('Audit');
  const audit = new Audit({
    _objectSchema: 'Query',
    action: action,
    meta: meta,
    objId: objId,
    performedBy: payload,
  });
  return audit.save();
};

exports.runDataQuery = async (
  modelType,
  role,
  userGuid,
  query,
  fields,
  sortWarmUp,
  sort,
  skip,
  limit,
  count,
  preQueryPipelineSteps,
  populateProponent = false,
  populateProjectLead = false,
  populateProjectDirector = false,
  postQueryPipelineSteps = false,
  populateProject = false
) => {
  let projection = {};
  let projectPermissions = [];
  const theModel = mongoose.model(modelType);
  const isUserQuery = modelType === 'User';
  let projectKey = modelType === 'Project' ? '$_id' : '$project';

  if (modelType === 'EmailSubscribe') {
    projectKey = query.project;
  }

  if (userGuid) {
    try {
      projectPermissions = await getUserProjectPermissions(userGuid);
    } catch (e) {
      defaultLog.error('Error fetching user project permissions', {
        message: e && e.message,
        stack: e && e.stack,
      });
    }
  }

  // Fields always returned
  const defaultFields = ['_id', 'code', 'proponent', 'tags', 'read'];
  each(defaultFields, (f) => {
    projection[f] = 1;
  });

  // Add requested fields only
  each(fields, (f) => {
    projection[f] = 1;
  });

  const aggregations = compact([
    { $match: query },
    { $project: projection },
    populateProponent && {
      $lookup: {
        from: 'lup',
        localField: 'proponent',
        foreignField: '_id',
        as: 'proponent',
      },
    },
    populateProponent && { $unwind: '$proponent' },

    populateProjectLead && {
      $lookup: {
        from: 'lup',
        localField: 'projectLead',
        foreignField: '_id',
        as: 'projectLead',
      },
    },
    populateProjectLead && {
      $unwind: {
        path: '$projectLead',
        preserveNullAndEmptyArrays: true,
      },
    },

    populateProjectDirector && {
      $lookup: {
        from: 'lup',
        localField: 'projectDirector',
        foreignField: '_id',
        as: 'projectDirector',
      },
    },
    populateProjectDirector && {
      $unwind: {
        path: '$projectDirector',
        preserveNullAndEmptyArrays: true,
      },
    },

    populateProject && {
      $lookup: {
        from: 'lup',
        localField: 'project',
        foreignField: '_id',
        as: 'project',
      },
    },
    populateProject && {
      $unwind: {
        path: '$project',
        preserveNullAndEmptyArrays: true,
      },
    },

    // Allow caller-provided post-lookup pipeline steps
    postQueryPipelineSteps,

    {
      $redact: {
        $cond: {
          if: {
            $and: [
              {
                $and: [
                  { $cond: { if: '$read', then: true, else: false } },
                  {
                    $anyElementTrue: {
                      $map: {
                        input: '$read',
                        as: 'fieldTag',
                        in: { $setIsSubset: [['$$fieldTag'], role] },
                      },
                    },
                  },
                ],
              },
              {
                $cond: {
                  if: { $in: ['public', role] },
                  then: true,
                  else: {
                    $cond: {
                      if: isUserQuery,
                      then: true,
                      else: {
                        $or: [
                          { $in: ['create-projects', role] },
                          { $in: [projectKey, projectPermissions] },
                        ],
                      },
                    },
                  },
                },
              },
            ],
          },
          then: '$$KEEP',
          else: { $cond: { if: '$read', then: '$$PRUNE', else: '$$DESCEND' } },
        },
      },
    },

    sortWarmUp, // Used to setup the sort if a temporary projection is needed.
    !isEmpty(sort) ? { $sort: sort } : null,
    sort ? { $project: projection } : null,

    // Count, if requested.
    count && {
      $group: {
        _id: null,
        total_items: { $sum: 1 },
        results: { $push: '$$ROOT' },
      },
    },
    count && {
      $project: {
        total_items: 1,
        results: { $slice: ['$results', skip, limit] },
      },
    },
    !count && { $skip: skip || 0 },
    !count && { $limit: limit || MAX_LIMIT },
  ]);

  // Optionally prepend caller-provided pipeline steps (joins, etc.)
  if (preQueryPipelineSteps && preQueryPipelineSteps.length > 0) {
    for (let step of preQueryPipelineSteps) {
      aggregations.unshift(step);
    }
  }

  const collation = { locale: 'en', strength: 2 };

  // Return the aggregate result (Promise)
  return theModel.aggregate(aggregations).collation(collation).exec();
};
