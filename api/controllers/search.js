var auth = require("../helpers/auth");
var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');
var request = require('request');
var _accessToken = null;

var searchCollection = async function (keywords, collection, pageNum, pageSize, project, sortField, sortDirection) {
  var properties = undefined;
  if (project) {
    properties = { project: mongoose.Types.ObjectId(project) };
  }

  // optional search keys
  var searchProperties = undefined;
  if (keywords) {
    searchProperties = { $text: { $search: keywords } };
  }

  var sortingValue = {};
  sortingValue[sortField] = sortDirection;
  console.log("sort:", sortingValue);
  console.log("pageNum:", pageNum);
  console.log("pageSize:", pageSize);
  // TODO MAKE ROLES COME IN HERE

  return new Promise(function (resolve, reject) {
    var collectionObj = mongoose.model(collection);
    collectionObj.aggregate(
      [
        { $match: { _schemaName: collection, ...(searchProperties ? searchProperties : undefined), ...(properties ? properties : undefined) } },
        {
          $redact: {
            $cond: {
              if: {
                $anyElementTrue: {
                  $map: {
                    input: "$read",
                    as: "fieldTag",
                    in: { $setIsSubset: [["$$fieldTag"], ['public']] }
                  }
                }
              },
              then: "$$KEEP",
              else: "$$PRUNE"
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
  var keywords = args.swagger.params.keywords.value;
  var dataset = args.swagger.params.dataset.value;
  var project = args.swagger.params.project.value;
  var pageNum = args.swagger.params.pageNum.value || 0;
  var pageSize = args.swagger.params.pageSize.value || 25;
  var sortBy = args.swagger.params.sortBy.value || ['-score'];
  defaultLog.info("Searching keywords:", keywords);
  defaultLog.info("Searching datasets:", dataset);
  defaultLog.info("Searching project:", project);
  defaultLog.info("pageNum:", pageNum);
  defaultLog.info("pageSize:", pageSize);
  defaultLog.info("sortBy:", sortBy);

  var sortDirection = undefined;
  var sortField = undefined;

  // TODO: Change away from array.  Only support 1.
  sortBy.map((value) => {
    sortDirection = value.charAt(0) == '-' ? -1 : 1;
    sortField = value.slice(1);
  });

  var sortingValue = {};
  sortingValue[sortField] = sortDirection;
  console.log("sort:", sortingValue);
  console.log("pageNum:", pageNum);
  console.log("pageSize:", pageSize);

  defaultLog.info("sortField:", sortField);
  defaultLog.info("sortDirection:", sortDirection);

  if (dataset === 'All') {
    var collectionObj = mongoose.model("Project");
    var data = await collectionObj.aggregate([
      {
        // TODO Include only models to which we want to search against, ie, documents, VCs and projects.
        $match: { _schemaName: { $in: ['Project', 'Document', 'Vc'] }, $text: { $search: keywords } }
      },
      {
        $redact: {
          $cond: {
            if: {
              $anyElementTrue: {
                $map: {
                  input: "$read",
                  as: "fieldTag",
                  in: { $setIsSubset: [["$$fieldTag"], ['public']] }
                }
              }
            },
            then: "$$KEEP",
            else: "$$PRUNE"
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
  } else {
    var data = await searchCollection(keywords, dataset, pageNum, pageSize, project, sortField, sortDirection)
    return Actions.sendResponse(res, 200, data);
  }
};

exports.protectedOptions = function (args, res, next) {
  res.status(200).send();
};