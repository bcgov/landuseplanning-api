var { map, each } = require('lodash');
var defaultLog = require('winston').loggers.get('defaultLog');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');
var qs = require('qs');

function isEmpty(obj) {
  for (var key in obj) {
    if (obj.hasOwnProperty(key))
      return false;
  }
  return true;
}

var generateExpArray = async function (field, roles) {
  var expArray = [];
  if (field && field != undefined) {
    var queryString = qs.parse(field);
    await Promise.all(Object.keys(queryString).map(async item => {
      if (item === 'pcp') {
        await handlePCPItem(roles, expArray, queryString[item]);
      } else if (item === 'decisionDateStart' || item === 'decisionDateEnd') {
        handleDateItem(expArray, item, queryString[item]);
      } else if (Array.isArray(queryString[item])) {
        // Arrays are a list of options so will always be ors
        var orArray = [];
        queryString[item].map(entry => {
          orArray.push(getConvertedValue(item, entry));
        });
        expArray.push({ $or: orArray });
      } else {
        expArray.push(getConvertedValue(item, queryString[item]));
      }
    }));
  }
  return expArray;
}

var getConvertedValue = function (item, entry) {
  if (isNaN(entry)) {
    if (mongoose.Types.ObjectId.isValid(entry)) {
      // ObjectID
      return { [item]: mongoose.Types.ObjectId(entry) };
    } else if (entry === 'true') {
      // Bool
      var tempObj = {}
      tempObj[item] = true;
      tempObj.active = true;
      return tempObj;
    } else if (entry === 'false') {
      // Bool
      return { [item]: false };
    } else {
      return { [item]: entry };
    }
  } else {
    return { [item]: parseInt(entry) };
  }
}

var handlePCPItem = async function (roles, expArray, value) {
  if (Array.isArray(value)) {
    // Arrays are a list of options so will always be ors
    var orArray = [];
    await Promise.all(value.map(async entry => {
      orArray.push(await getPCPValue(roles, entry));
    }));
    expArray.push({ $or: orArray });
  } else {
    expArray.push(await getPCPValue(roles, value));
  }
}

var getPCPValue = async function (roles, entry) {
  var query = null;
  var now = new Date();

  switch (entry) {
    case 'pending':
      var in7days = new Date();
      in7days.setDate(now.getDate() + 7);

      query = {
        _schemaName: 'CommentPeriod',
        $and: [
          { dateStarted: { $gt: now } },
          { dateStarted: { $lte: in7days } }
        ]
      };
      break;

    case 'open':
      query = {
        _schemaName: 'CommentPeriod',
        $and: [
          { dateStarted: { $lte: now } },
          { dateCompleted: { $gt: now } }
        ]
      };
      break;

    case 'closed':
      query = {
        _schemaName: 'CommentPeriod',
        dateCompleted: { $lt: now }
      };
      break;

    default:
      defaultLog.info('Unknown PCP entry');
  }

  var pcp = {};

  if (query) {
    var data = await Utils.runDataQuery('CommentPeriod', roles, query, ['project'], null, null, null, null, false, null);
    var ids = map(data, 'project');
    pcp = { _id: { $in: ids } };
  }

  defaultLog.info('pcp', pcp);
  return pcp;
}

var handleDateItem = function (expArray, item, entry) {
  var date = new Date(entry);

  // Validate: valid date?
  if (!isNaN(date)) {
    if (item === 'decisionDateStart') {
      var start = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
      expArray.push({ decisionDate: { $gte: start } });
    } else if (item === 'decisionDateEnd') {
      var end = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
      expArray.push({ decisionDate: { $lt: end } });
    }
  }
}

var searchCollection = async function (roles, projectPermissions, keywords, collection, pageNum, pageSize, project, sortField, sortDirection, caseSensitive, populate = false, and, or) {
  var properties = undefined;
  let projectKey;
  if (project) {
    properties = { project: mongoose.Types.ObjectId(project) };
    projectKey = "$project";
  }

  if (collection && collection === 'Project') {
    projectKey = "$_id";
  }

  // optional search keys
  var searchProperties = undefined;
  if (keywords) {
    searchProperties = { $text: { $search: keywords, $caseSensitive: caseSensitive } };
  }

  // query modifiers
  var andExpArray = await generateExpArray(and, roles);

  // filters
  var orExpArray = await generateExpArray(or, roles);

  var modifier = {};
  if (andExpArray.length > 0 && orExpArray.length > 0) {
    modifier = { $and: [{ $and: andExpArray }, { $and: orExpArray }] };
  } else if (andExpArray.length === 0 && orExpArray.length > 0) {
    modifier = { $and: orExpArray };
  } else if (andExpArray.length > 0 && orExpArray.length === 0) {
    modifier = { $and: andExpArray };
  }

  var match = {
    _schemaName: collection,
    ...(isEmpty(modifier) ? undefined : modifier),
    ...(searchProperties ? searchProperties : undefined),
    ...(properties ? properties : undefined),
    $or: [
      { isDeleted: { $exists: false } },
      { isDeleted: false },
    ]
  };

  var sortingValue = {};
  sortingValue[sortField] = sortDirection;

  // We don't want to have sort in the aggregation if the front end doesn't need sort.
  let searchResultAggregation = [
    {
      $sort: sortingValue
    },
    {
      $skip: pageNum * pageSize
    },
    {
      $limit: pageSize
    }
  ];

  var aggregation = [
    {
      $match: match
    }
  ];

  let collation = {
    locale: 'en',
    strength: 2
  };

  if (collection === 'Document') {
    // Allow documents to be sorted by status based on publish existence
    aggregation.push(
      {
        $addFields: {
          "status": {
            $cond: {
              if: {
                // This way, if read isn't present, we assume public no roles array.
                $and: [
                  { $cond: { if: "$read", then: true, else: false } },
                  {
                    $anyElementTrue: {
                      $map: {
                        input: "$read",
                        as: "fieldTag",
                        in: { $setIsSubset: [["$$fieldTag"], ['public']] }
                      }
                    }
                  }
                ]
              },
              then: 'published',
              else: 'unpublished'
            }
          }
        }
      }
    );
  }

  if (collection === 'Group') {
    // pop project and user if exists.
    aggregation.push(
      {
        '$lookup': {
          "from": "lup",
          "localField": "project",
          "foreignField": "_id",
          "as": "project"
        }
      });
    aggregation.push(
      {
        "$unwind": "$project"
      },
    );
  }

  // Redact results based on user permissions.
  aggregation.push({
    $redact: {
      $cond: {
        if: {
          // This way, if read isn't present, we assume public no roles array.
          $and: [
            {
              $and: [
                { $cond: { if: "$read", then: true, else: false } },
                {
                  $anyElementTrue: {
                    $map: {
                      input: "$read",
                      as: "fieldTag",
                      in: { $setIsSubset: [["$$fieldTag"], roles] }
                    }
                  }
                }
              ]
            },
            // Check if user either has the create-projects role or has project permissions.
            { $cond: 
              { if: { $in: ["public", roles] }, then: true, else:
                { $or: [
                  { $in: [ "create-projects" , roles] },
                  { $in: [ projectKey, projectPermissions ] }
                  ]
                } 
              }
            }
          ]
        },
        then: "$$KEEP",
        else: {
          $cond: { if: "$read", then: "$$PRUNE", else: "$$DESCEND" }
        }
      }
    }
  });

  if (populate === true && collection !== 'Project') {
    aggregation.push({
      "$lookup": {
        "from": "lup",
        "localField": "project",
        "foreignField": "_id",
        "as": "project"
      }
    });
    aggregation.push({
      "$addFields": {
        project: "$project",
      }
    });
    aggregation.push({
      "$unwind": {
        "path": "$project",
        "preserveNullAndEmptyArrays": true
      }
    });
  }

  // Redact results based on user permissions.
  aggregation.push({
    $addFields: {
      score: { $meta: "textScore" }
    }
  });

  aggregation.push({
    $facet: {
      searchResults: searchResultAggregation,
      meta: [
        {
          $count: "searchResultsTotal"
        }
      ]
    }
  })

  return new Promise(function (resolve, reject) {
    var collectionObj = mongoose.model(collection);
    collectionObj.aggregate(aggregation)
      .collation(collation)
      .exec()
      .then(function (data) {
        resolve(data);
      }, reject);
  });
}

exports.publicGet = async function (args, res, next) {
  defaultLog.info('PUBLIC SEARCH COLLECTION');
  executeQuery(args, res, next);
};

exports.protectedGet = function (args, res, next) {
  defaultLog.info('PROTECTED SEARCH COLLECTION');
  executeQuery(args, res, next);
};

var executeQuery = async function (args, res, next) {
  var _id = args.swagger.params._id ? args.swagger.params._id.value : null;
  var keywords = args.swagger.params.keywords.value;
  var dataset = args.swagger.params.dataset.value;
  var project = args.swagger.params.project.value;
  var populate = args.swagger.params.populate ? args.swagger.params.populate.value : false;
  var pageNum = args.swagger.params.pageNum.value || 0;
  var pageSize = args.swagger.params.pageSize.value || 25;
  var sortBy = args.swagger.params.sortBy.value || ['-score'];
  var caseSensitive = args.swagger.params.caseSensitive ? args.swagger.params.caseSensitive.value : false;
  var and = args.swagger.params.and ? args.swagger.params.and.value : '';
  var or = args.swagger.params.or ? args.swagger.params.or.value : '';
  let userProjectPermissions = [];
  let projectKey = '$project';
  defaultLog.info("Searching keywords:", keywords);
  defaultLog.info("Searching datasets:", dataset);
  defaultLog.info("Searching project:", project);
  defaultLog.info("pageNum:", pageNum);
  defaultLog.info("pageSize:", pageSize);
  defaultLog.info("sortBy:", sortBy);
  defaultLog.info("caseSensitive:", caseSensitive);
  defaultLog.info("and:", and);
  defaultLog.info("or:", or);
  defaultLog.info("_id:", _id);
  defaultLog.info("populate:", populate);

  if (project) {
    projectKey = '$_id';
  }

  var roles = args.swagger.params.auth_payload ? args.swagger.params.auth_payload.realm_access.roles : ['public'];

  // Get user project permissions array.
  if (args.swagger.params.auth_payload && args.swagger.params.auth_payload.sub) {
    userProjectPermissions = await Utils.getUserProjectPermissions(args.swagger.params.auth_payload.sub)
      .then(permissions => (permissions));
  }

  Utils.recordAction('Search', keywords, args.swagger.params.auth_payload ? args.swagger.params.auth_payload.preferred_username : 'public')

  var sortDirection = undefined;
  var sortField = undefined;

  var sortingValue = {};
  sortBy.forEach((value) => {
    sortDirection = value.charAt(0) == '-' ? -1 : 1;
    sortField = value.slice(1);
    sortingValue[sortField] = sortDirection;
  });

  if (dataset !== 'Item') {
    var data = await searchCollection(roles, userProjectPermissions, keywords, dataset, pageNum, pageSize, project, sortField, sortDirection, caseSensitive, populate, and, or)
    if (dataset === 'Comment') {
      // Filter
      each(data[0].searchResults, function (item) {
        if (item.isAnonymous === true) {
          delete item.author;
        }
      });
    }
    return Actions.sendResponse(res, 200, data);

  } else if (dataset === 'Item') {

    var collectionObj = mongoose.model(args.swagger.params._schemaName.value);
    var data = await collectionObj.aggregate([
      {
        "$match": { _id: mongoose.Types.ObjectId(args.swagger.params._id.value) }
      },
      {
        $redact: {
          $cond: {
            if: {
              // This way, if read isn't present, we assume public no roles array.
              $and: [
                { $cond: { if: "$read", then: true, else: false } },
                {
                  $anyElementTrue: {
                    $map: {
                      input: "$read",
                      as: "fieldTag",
                      in: { $setIsSubset: [["$$fieldTag"], roles] }
                    }
                  }
                },
                // Check if user either has the create-projects role or has project permissions.
                { $cond: 
                  { if: { $in: ["public", roles] }, then: true, else:
                    { $or: [
                      { $in: [ "create-projects" , roles] },
                      { $in: [ projectKey, userProjectPermissions ] } 
                      ]
                    } 
                  }
                }
              ]
            },
            then: "$$KEEP",
            else: {
              $cond: { if: "$read", then: "$$PRUNE", else: "$$DESCEND" }
            }
          }
        }
      }
    ]);
    if (args.swagger.params._schemaName.value === 'Comment') {
      // Filter
      each(data, function (item) {
        if (item.isAnonymous === true) {
          delete item.author;
        }
      });
    }
    return Actions.sendResponse(res, 200, data);
  } else {
    defaultLog.error('Bad Request. Could not complete search.');
    return Actions.sendResponse(res, 400, {});
  }
};

exports.protectedOptions = function (args, res) {
  defaultLog.info('SEARCH PROTECTED OPTIONS');
  res.status(200).send();
};
