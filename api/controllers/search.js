var auth = require("../helpers/auth");
var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');
var request = require('request');
var _accessToken = null;
var qs = require('qs');

function isEmpty(obj) {
  for(var key in obj) {
      if(obj.hasOwnProperty(key))
          return false;
  }
  return true;
}

var searchCollection = async function (roles, keywords, collection, pageNum, pageSize, project, sortField, sortDirection, query) {
  var properties = undefined;
  if (project) {
    properties = { project: mongoose.Types.ObjectId(project) };
  }

  // optional search keys
  var searchProperties = undefined;
  if (keywords) {
    searchProperties = { $text: { $search: keywords } };
  }

  // optional keyed lookups
  var queryModifer = {};
  if (query) {
    if (query && query !== undefined) {
      var queryString = qs.parse(query);
      console.log("query:", queryString);
      Object.keys(queryString).map(item => {
        console.log("item:", item, queryString[item]);
        if (isNaN(queryString[item])) {
          // String or Bool
          if (queryString[item] === 'true') {
            // Bool
            queryModifer[item] = true;
            queryModifer.active = true;
          } else if (queryString[item] === 'false') {
            // Bool
            queryModifer[item] = false;
          } else {
            // String
            queryModifer[item] = queryString[item];
          }
        } else {
          // Number
          queryModifer[item] = parseInt(queryString[item]);
        }
      })
    }
  }

  var match = { _schemaName: collection,
    ...(isEmpty(queryModifer) ? undefined : queryModifer),
    ...(searchProperties ? searchProperties : undefined),
    ...(properties ? properties : undefined),
    $or: [
        { isDeleted: { $exists:false } },
        { isDeleted: false }
      ]
  };

  console.log("queryModifer:", queryModifer);
  console.log("match:", match);

  var sortingValue = {};
  sortingValue[sortField] = sortDirection;


  return new Promise(function (resolve, reject) {
    var collectionObj = mongoose.model(collection);
    collectionObj.aggregate(
      [
        { $match: match },
        {
          "$lookup": {
            "from": "epic",
            "localField": "project",
            "foreignField": "_id",
            "as": "project"
          }
        },
        {
          "$addFields": {
            "project": {
              "$map": {
                "input": "$project",
                "as": "project",
                "in": {
                  "_id": "$$project._id",
                  "name": "$$project.name"
                }
              }
            }
          }
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
                  }
                ]
              },
              then: "$$KEEP",
              else: {
                $cond: { if: "$read", then: "$$PRUNE", else: "$$DESCEND" }
              }
            }
          }
        },
        {
          $addFields: {
            score: { $meta: "textScore" }
          }
        },
        {
          $facet: {
            searchResults: [
              {
                $sort: sortingValue
              },
              {
                $skip: pageNum * pageSize
              },
              {
                $limit: pageSize
              }
            ],
            meta: [
              {
                $count: "searchResultsTotal"
              }
            ]
          }
        }
      ])
      .exec()
      .then(function (data) {
        resolve(data);
      }, reject);
  });
}

exports.publicGet = async function (args, res, next) {
  executeQuery(args, res, next);
};

exports.protectedGet = function (args, res, next) {
  executeQuery(args, res, next);
};

var executeQuery = async function (args, res, next) {
  var _id = args.swagger.params._id ? args.swagger.params._id.value : null;
  var keywords = args.swagger.params.keywords.value;
  var dataset = args.swagger.params.dataset.value;
  var project = args.swagger.params.project.value;
  var pageNum = args.swagger.params.pageNum.value || 0;
  var pageSize = args.swagger.params.pageSize.value || 25;
  var sortBy = args.swagger.params.sortBy.value || ['-score'];
  var query = args.swagger.params.query ? args.swagger.params.query.value : '';
  defaultLog.info("Searching keywords:", keywords);
  defaultLog.info("Searching datasets:", dataset);
  defaultLog.info("Searching project:", project);
  defaultLog.info("pageNum:", pageNum);
  defaultLog.info("pageSize:", pageSize);
  defaultLog.info("sortBy:", sortBy);
  defaultLog.info("query:", query);
  defaultLog.info("_id:", _id);

  var roles = args.swagger.params.auth_payload ? args.swagger.params.auth_payload.realm_access.roles : ['public'];

  console.log("******************************************************************");
  console.log(roles);
  console.log("******************************************************************");

  Utils.recordAction('search', keywords, args.swagger.params.auth_payload ? args.swagger.params.auth_payload.preferred_username : 'public')

  var sortDirection = undefined;
  var sortField = undefined;

  // TODO: Change away from array.  Only support 1.
  sortBy.map((value) => {
    sortDirection = value.charAt(0) == '-' ? -1 : 1;
    sortField = value.slice(1);
  });

  var sortingValue = {};
  sortingValue[sortField] = sortDirection;

  defaultLog.info("sortField:", sortField);
  defaultLog.info("sortDirection:", sortDirection);

  if (dataset === 'All') {
    console.log("Searching Collection:", dataset);
    var collectionObj = mongoose.model("Project");
    var data = await collectionObj.aggregate([
      {
        // TODO Include only models to which we want to search against, ie, documents, VCs and projects.
        $match: { _schemaName: { $in: ['Project', 'Document', 'Vc'] },
                  $text: { $search: keywords } }
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
                }
              ]
            },
            then: "$$KEEP",
            else: {
              $cond: { if: "$read", then: "$$PRUNE", else: "$$DESCEND" }
            }
          }
        }
      },
      {
        $addFields: {
          score: { $meta: "textScore" }
        }
      },
      {
        $facet: {
          searchResults: [
            {
              $sort: sortingValue
            },
            {
              $skip: pageNum * pageSize
            },
            {
              $limit: pageSize
            }
          ],
          meta: [
            {
              $count: "searchResultsTotal"
            }
          ]
        }
      }
    ])
    return Actions.sendResponse(res, 200, data);
  } else if (dataset !== 'Item'){

    console.log("Searching Collection:", dataset);
    console.log("sortField:", sortField);
    var data = await searchCollection(roles, keywords, dataset, pageNum, pageSize, project, sortField, sortDirection, query)
    return Actions.sendResponse(res, 200, data);

  } else if (dataset === 'Item') {
    var collectionObj = mongoose.model(args.swagger.params._schemaName.value);
    console.log("ITEM GET", {_id: args.swagger.params._id.value})
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
    return Actions.sendResponse(res, 200, data);
  } else {
    console.log('Bad Request');
    return Actions.sendResponse(res, 400, {});
  }
};

exports.protectedOptions = function (args, res, next) {
  res.status(200).send();
};