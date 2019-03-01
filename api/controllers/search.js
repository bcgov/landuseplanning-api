var auth = require("../helpers/auth");
var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');
var request = require('request');
var _accessToken = null;

var searchCollection = async function (keywords, collection, skip, limit) {
  return new Promise(function (resolve, reject) {
    var collectionObj = mongoose.model(collection);
    collectionObj.aggregate(
      [
        { $match: { _schemaName: collection, $text: { $search: keywords } } },
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
                $sort: { score: -1 }
              },
              {
                $skip: skip
              },
              {
                $limit: limit
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
  var skip = args.swagger.params.skip.value || 0;
  var limit = args.swagger.params.limit.value || 25;
  defaultLog.info("Searching keywords:", keywords);
  defaultLog.info("Searching datasets:", dataset);

  // TODO: Enable pagination/skip/limit.
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
              $sort: { score: -1 }
            },
            {
              $skip: skip
            },
            {
              $limit: limit
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
    var data = await searchCollection(keywords, dataset, skip, limit)
    return Actions.sendResponse(res, 200, data);
  }
};

exports.protectedOptions = function (args, res, next) {
  res.status(200).send();
};