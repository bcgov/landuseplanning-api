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
  for (var key in obj) {
    if (obj.hasOwnProperty(key))
      return false;
  }
  return true;
}

var generateExpArray = function (field) {
  var expArray = [];
  if (field && field !== undefined) {
    var queryString = qs.parse(field);
    console.log("queryString:", queryString);
    Object.keys(queryString).map(item => {
      console.log("item:", item, queryString[item]);
      if (Array.isArray(queryString[item])) {
        // Arrays will always be ors
        var orArray = [];
        queryString[item].map(entry => {
          orArray.push(getConvertedValue(item, entry));
        });
        expArray.push({ $or: orArray });
      } else {
        expArray.push(getConvertedValue(item, queryString[item]));
      }
    })
  }
  console.log("expArray:", expArray);
  return expArray;
}

var getConvertedValue = function (item, entry) {
  if (isNaN(entry)) {
    if (mongoose.Types.ObjectId.isValid(entry)) {
      console.log("objectid");
      // ObjectID
      return { [item]: mongoose.Types.ObjectId(entry) };
    } else if (entry === 'true') {
      console.log("bool");
      // Bool
      var tempObj = {}
      tempObj[item] = true;
      tempObj.active = true;
      return tempObj;
    } else if (entry === 'false') {
      console.log("bool");
      // Bool
      return { [item]: false };
    } else {
      console.log("string");
      return { [item]: entry };
    }
  } else {
      console.log("number");
      return { [item]: parseInt(entry) };
  }
}

var searchCollection = async function (roles, keywords, collection, pageNum, pageSize, project, sortField, sortDirection, caseSensitive, populate = false, and, or) {
  var properties = undefined;
  if (project) {
    properties = { project: mongoose.Types.ObjectId(project) };
  }

  // optional search keys
  var searchProperties = undefined;
  if (keywords) {
    searchProperties = { $text: { $search: keywords, $caseSensitive: caseSensitive } };
  }

  // query modifiers
  var andExpArray = generateExpArray(and);

  // filters
  var orExpArray = generateExpArray(or);

  var modifier = {};
  if (andExpArray.length > 0 && orExpArray.length > 0) {
    modifier = { $and: [{ $and: andExpArray }, { $and: orExpArray }] };
  } else if (andExpArray.length === 0 && orExpArray.length > 0) {
    modifier = { $and: orExpArray  };
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

  console.log("modifier:", modifier);
  console.log("match:", match);

  var sortingValue = {};
  sortingValue[sortField] = sortDirection;

  // We don't want to have sort in the aggrigation if the front end doesn't need sort.
  let searchResultAggrigation = [
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

  console.log('collation:', collation);

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

  if (collection === 'Project') {
    // pop proponent if exists.
    aggregation.push(
      {
        '$lookup': {
          "from": "epic",
          "localField": "proponent",
          "foreignField": "_id",
          "as": "proponent"
        }
      });
    aggregation.push(
      {
        "$unwind": "$proponent"
      },
    );
  }

  if (collection === 'Group') {
    // pop project and user if exists.
    aggregation.push(
      {
        '$lookup': {
          "from": "epic",
          "localField": "contact",
          "foreignField": "_id",
          "as": "contact"
        }
      });
    aggregation.push(
      {
        "$unwind": "$contact"
      },
    );
    aggregation.push(
      {
        '$lookup': {
          "from": "epic",
          "localField": "contact.org",
          "foreignField": "_id",
          "as": "contact.org"
        }
      });
    aggregation.push(
      {
        "$unwind": "$contact.org"
      },
    );
  }

  if (collection === 'User') {
    // pop proponent if exists.
    aggregation.push(
      {
        '$lookup': {
          "from": "epic",
          "localField": "org",
          "foreignField": "_id",
          "as": "org"
        }
      });
    aggregation.push(
      {
        "$unwind": "$org"
      },
    );
  }
 
  console.log('populate:', populate);
  if (populate === true && collection !== 'Project') {
    aggregation.push({
      "$lookup": {
        "from": "epic",
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

  aggregation.push({
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
  });

  aggregation.push({
    $addFields: {
      score: { $meta: "textScore" }
    }
  });

  aggregation.push({
    $facet: {
      searchResults: searchResultAggrigation,
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
  var populate = args.swagger.params.populate ? args.swagger.params.populate.value : false;
  var pageNum = args.swagger.params.pageNum.value || 0;
  var pageSize = args.swagger.params.pageSize.value || 25;
  var sortBy = args.swagger.params.sortBy.value || ['-score'];
  var caseSensitive = args.swagger.params.caseSensitive ? args.swagger.params.caseSensitive.value : false;
  var and = args.swagger.params.and ? args.swagger.params.and.value : '';
  var or = args.swagger.params.or ? args.swagger.params.or.value : '';
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

  var roles = args.swagger.params.auth_payload ? args.swagger.params.auth_payload.realm_access.roles : ['public'];

  console.log("Searching Collection:", dataset);

  console.log("******************************************************************");
  console.log(roles);
  console.log("******************************************************************");

  Utils.recordAction('search', keywords, args.swagger.params.auth_payload ? args.swagger.params.auth_payload.preferred_username : 'public')

  var sortDirection = undefined;
  var sortField = undefined;

  var sortingValue = {};
  sortBy.map((value) => {
    sortDirection = value.charAt(0) == '-' ? -1 : 1;
    sortField = value.slice(1);
    sortingValue[sortField] = sortDirection;
  });

  console.log("sortingValue:", sortingValue);
  defaultLog.info("sortField:", sortField);
  defaultLog.info("sortDirection:", sortDirection);

  if (dataset !== 'Item') {

    console.log("Searching Collection:", dataset);
    console.log("sortField:", sortField);
    var data = await searchCollection(roles, keywords, dataset, pageNum, pageSize, project, sortField, sortDirection, caseSensitive, populate, and, or)
    if (dataset === 'Comment') {
      // Filter
      _.each(data[0].searchResults, function (item) {
        if (item.isAnonymous === true) {
          delete item.author;
        }
      });
    }
    return Actions.sendResponse(res, 200, data);

  } else if (dataset === 'Item') {
    var collectionObj = mongoose.model(args.swagger.params._schemaName.value);
    console.log("ITEM GET", { _id: args.swagger.params._id.value })
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
    if (args.swagger.params._schemaName.value === 'Comment') {
      // Filter
      _.each(data, function (item) {
        if (item.isAnonymous === true) {
          delete item.author;
        }
      });
    }
    return Actions.sendResponse(res, 200, data);
  } else {
    console.log('Bad Request');
    return Actions.sendResponse(res, 400, {});
  }
};

exports.protectedOptions = function (args, res, next) {
  res.status(200).send();
};
