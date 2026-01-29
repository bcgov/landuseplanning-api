const { map, each } = require('lodash');
const defaultLog = require('winston').loggers.get('defaultLog');
const mongoose = require('mongoose');
const Actions = require('../helpers/actions');
const Utils = require('../helpers/utils');
const qs = require('qs');

const isEmpty = (obj) => {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) return false;
  }
  return true;
};

const generateExpArray = async (field, roles) => {
  const expArray = [];
  if (field !== null) {
    const queryString = qs.parse(field);
    await Promise.all(
      Object.keys(queryString).map(async (item) => {
        if (item === 'pcp') {
          await handlePCPItem(roles, expArray, queryString[item]);
        } else if (item === 'decisionDateStart' || item === 'decisionDateEnd') {
          handleDateItem(expArray, item, queryString[item]);
        } else if (Array.isArray(queryString[item])) {
          // Arrays are a list of options so will always be ors
          const orArray = [];
          queryString[item].map((entry) => {
            orArray.push(getConvertedValue(item, entry));
          });
          expArray.push({ $or: orArray });
        } else {
          expArray.push(getConvertedValue(item, queryString[item]));
        }
      })
    );
  }
  return expArray;
};

const getConvertedValue = (item, entry) => {
  if (isNaN(entry)) {
    if (mongoose.Types.ObjectId.isValid(entry)) {
      // ObjectID
      return { [item]: mongoose.Types.ObjectId(entry) };
    } else if (entry === 'true') {
      // Bool
      const tempObj = {};
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
    return { [item]: parseInt(entry, 10) };
  }
};

const handlePCPItem = async (roles, expArray, value) => {
  if (Array.isArray(value)) {
    // Arrays are a list of options so will always be ors
    const orArray = [];
    await Promise.all(
      value.map(async (entry) => {
        orArray.push(await getPCPValue(roles, entry));
      })
    );
    expArray.push({ $or: orArray });
  } else {
    expArray.push(await getPCPValue(roles, value));
  }
};

const getPCPValue = async (roles, entry) => {
  let query = null;
  const now = new Date();

  switch (entry) {
    case 'pending': {
      const in7days = new Date();
      in7days.setDate(now.getDate() + 7);

      query = {
        _schemaName: 'CommentPeriod',
        $and: [
          { dateStarted: { $gt: now } },
          { dateStarted: { $lte: in7days } },
        ],
      };
      break;
    }

    case 'open':
      query = {
        _schemaName: 'CommentPeriod',
        $and: [{ dateStarted: { $lte: now } }, { dateCompleted: { $gt: now } }],
      };
      break;

    case 'closed':
      query = {
        _schemaName: 'CommentPeriod',
        dateCompleted: { $lt: now },
      };
      break;

    default:
      defaultLog.info('Unknown PCP entry');
  }

  let pcp = {};

  if (query) {
    const data = await Utils.runDataQuery(
      'CommentPeriod',
      roles,
      query,
      ['project'],
      null,
      null,
      null,
      null,
      false,
      null
    );
    const ids = map(data, 'project');
    pcp = { _id: { $in: ids } };
  }

  defaultLog.info('pcp', pcp);
  return pcp;
};

const handleDateItem = (expArray, item, entry) => {
  const date = new Date(entry);

  // Validate: valid date?
  if (!isNaN(date)) {
    if (item === 'decisionDateStart') {
      const start = new Date(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
      );
      expArray.push({ decisionDate: { $gte: start } });
    } else if (item === 'decisionDateEnd') {
      const end = new Date(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + 1
      );
      expArray.push({ decisionDate: { $lt: end } });
    }
  }
};

const searchCollection = async (
  roles,
  projectPermissions,
  keywords,
  collection,
  pageNum,
  pageSize,
  project,
  sortField,
  sortDirection,
  caseSensitive,
  populate = false,
  and,
  or
) => {
  let properties = undefined;
  let projectKey;

  if (project) {
    properties = { project: mongoose.Types.ObjectId(project) };
    projectKey = '$project';
  }

  if (collection && collection === 'Project') {
    projectKey = '$_id';
  }

  // optional search keys
  let searchProperties = undefined;
  if (keywords) {
    searchProperties = {
      $text: { $search: keywords, $caseSensitive: caseSensitive },
    };
  }

  // query modifiers
  const andExpArray = await generateExpArray(and, roles);

  // filters
  const orExpArray = await generateExpArray(or, roles);

  let modifier = {};
  if (andExpArray.length > 0 && orExpArray.length > 0) {
    modifier = { $and: [{ $and: andExpArray }, { $and: orExpArray }] };
  } else if (andExpArray.length === 0 && orExpArray.length > 0) {
    modifier = { $and: orExpArray };
  } else if (andExpArray.length > 0 && orExpArray.length === 0) {
    modifier = { $and: andExpArray };
  }

  const match = {
    _schemaName: collection,
    ...(isEmpty(modifier) ? undefined : modifier),
    ...(searchProperties ? searchProperties : undefined),
    ...(properties ? properties : undefined),
    $or: [{ isDeleted: { $exists: false } }, { isDeleted: false }],
  };

  const collation = {
    locale: 'en',
    strength: 2,
  };

  const aggregation = [{ $match: match }];

  // Only add this block when sorting by projectTypes
  if (sortField === 'projectTypes') {
    aggregation.push({
      $addFields: {
        projectTypesFiltered: {
          $map: {
            input: {
              $filter: {
                input: '$projectTypes',
                as: 'pt',
                cond: { $eq: ['$$pt.checked', true] },
              },
            },
            as: 'filtered',
            in: '$$filtered.name',
          },
        },
      },
    });
  }

  // Define sorting object/stage for Mongo stage
  let searchResultAggregation = [];
  if (sortField !== 'projectTypes') {
    const sortStage =
      sortField === 'score' && keywords
        ? { $sort: { score: { $meta: 'textScore' } } }
        : { $sort: { [sortField]: sortDirection } };

    searchResultAggregation.push(
      sortStage,
      { $skip: pageNum * pageSize },
      { $limit: pageSize }
    );
  } else {
    // skip/limit still done in MongoDB
    searchResultAggregation.push(
      { $skip: pageNum * pageSize },
      { $limit: pageSize }
    );
  }

  if (collection === 'Document') {
    // Allow documents to be sorted by status based on publish existence
    aggregation.push({
      $addFields: {
        status: {
          $cond: {
            if: {
              // This way, if read isn't present, we assume public no roles array.
              $and: [
                { $cond: { if: '$read', then: true, else: false } },
                {
                  $anyElementTrue: {
                    $map: {
                      input: '$read',
                      as: 'fieldTag',
                      in: { $setIsSubset: [['$$fieldTag'], ['public']] },
                    },
                  },
                },
              ],
            },
            then: 'published',
            else: 'unpublished',
          },
        },
      },
    });
  }

  if (collection === 'Group') {
    // pop project and user if exists.
    aggregation.push({
      $lookup: {
        from: 'lup',
        localField: 'project',
        foreignField: '_id',
        as: 'project',
      },
    });
    aggregation.push({
      $unwind: '$project',
    });
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
                { $cond: { if: '$read', then: true, else: false } },
                {
                  $anyElementTrue: {
                    $map: {
                      input: '$read',
                      as: 'fieldTag',
                      in: { $setIsSubset: [['$$fieldTag'], roles] },
                    },
                  },
                },
              ],
            },
            // Check if user either has the create-projects role or has project permissions.
            {
              $cond: {
                if: { $in: ['public', roles] },
                then: true,
                else: {
                  $or: [
                    { $in: ['create-projects', roles] },
                    { $in: [projectKey, projectPermissions] },
                  ],
                },
              },
            },
          ],
        },
        then: '$$KEEP',
        else: {
          $cond: { if: '$read', then: '$$PRUNE', else: '$$DESCEND' },
        },
      },
    },
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

  if (typeof keywords === 'string' && keywords.trim().length > 0) {
    // Redact results based on user permissions.
    aggregation.push({
      $addFields: {
        score: { $meta: "textScore" }
      }
    });
  }
  

  if (sortField !== 'projectTypes') {
    aggregation.push({
      $facet: {
        searchResults: searchResultAggregation,
        meta: [
          {
            $count: 'searchResultsTotal',
          },
        ],
      },
    });
  }

  const collectionObj = mongoose.model(collection);
  const data = await collectionObj
    .aggregate(aggregation)
    .collation(collation)
    .exec();

  let collectionData;

  // If the sort field is projectTypes, handle the sorting manually.
  if (sortField === 'projectTypes') {
    const rawResults = data || [];
    rawResults.forEach((rr) => {
      const list = Array.isArray(rr.projectTypesFiltered)
        ? rr.projectTypesFiltered
        : [];
      const sorted = list.slice().sort(); // alphabetically
      rr._projectTypesString = sorted.join(', ');
    });

    const sortedResults = rawResults.sort(
      (a, b) =>
        a._projectTypesString.localeCompare(b._projectTypesString) *
        sortDirection
    );

    const start = pageNum * pageSize;
    const end = start + pageSize;
    const pagedResults = sortedResults.slice(start, end);

    pagedResults.forEach((pr) => {
      delete pr._projectTypesString;
    });

    collectionData = {
      searchResults: pagedResults,
      meta: [{ searchResultsTotal: sortedResults.length }],
    };
  } else {
    // Otherwise we'll return the db-sorted data.
    collectionData = data[0] || { searchResults: [], meta: [] };
  }

  return [collectionData];
};

exports.publicGet = async (args, res) => {
  defaultLog.info('PUBLIC SEARCH COLLECTION');
  await executeQuery(args, res);
};

exports.protectedGet = async (args, res) => {
  defaultLog.info('PROTECTED SEARCH COLLECTION');
  await executeQuery(args, res);
};

const executeQuery = async (args, res) => {
  const _id = args.swagger.params._id ? args.swagger.params._id.value : null;
  const keywords = args.swagger.params.keywords.value;
  const dataset = args.swagger.params.dataset.value;
  const project = args.swagger.params.project.value;
  const populate = args.swagger.params.populate
    ? args.swagger.params.populate.value
    : false;
  const pageNum = args.swagger.params.pageNum.value || 0;
  const pageSize = args.swagger.params.pageSize.value || 25;
  const sortBy = args.swagger.params.sortBy.value || ['-score'];
  const caseSensitive = args.swagger.params.caseSensitive
    ? args.swagger.params.caseSensitive.value
    : false;
  const and = args.swagger.params.and ? args.swagger.params.and.value : '';
  const or = args.swagger.params.or ? args.swagger.params.or.value : '';
  let userProjectPermissions = [];
  let projectKey = '$project';
  defaultLog.info('Searching keywords:', keywords);
  defaultLog.info('Searching datasets:', dataset);
  defaultLog.info('Searching project:', project);
  defaultLog.info('pageNum:', pageNum);
  defaultLog.info('pageSize:', pageSize);
  defaultLog.info('sortBy:', sortBy);
  defaultLog.info('caseSensitive:', caseSensitive);
  defaultLog.info('and:', and);
  defaultLog.info('or:', or);
  defaultLog.info('_id:', _id);
  defaultLog.info('populate:', populate);

  if (project) {
    projectKey = '$_id';
  }

  const roles = args.swagger.params.auth_payload
    ? args.swagger.params.auth_payload.client_roles
    : ['public'];

  // Get user project permissions array.
  if (
    args.swagger.params.auth_payload &&
    args.swagger.params.auth_payload.idir_user_guid
  ) {
    userProjectPermissions = await Utils.getUserProjectPermissions(
      args.swagger.params.auth_payload.idir_user_guid
    );
  }

  Utils.recordAction(
    'Search',
    keywords,
    args.swagger.params.auth_payload
      ? args.swagger.params.auth_payload.preferred_username
      : 'public'
  );

  let sortDirection = undefined;
  let sortField = undefined;

  sortBy.forEach((value) => {
    sortDirection = value.charAt(0) == '-' ? -1 : 1;
    sortField = value.slice(1);
  });

  if (dataset !== 'Item') {
    const data = await searchCollection(
      roles,
      userProjectPermissions,
      keywords,
      dataset,
      pageNum,
      pageSize,
      project,
      sortField,
      sortDirection,
      caseSensitive,
      populate,
      and,
      or
    );
    // Filter
    each(data[0].searchResults, (item) => {
      if (item.isAnonymous === true) {
        delete item.author;
      }
    });
    return Actions.sendResponse(res, 200, data);
  } else if (dataset === 'Item') {
    const collectionObj = mongoose.model(args.swagger.params._schemaName.value);
    const data = await collectionObj.aggregate([
      {
        $match: { _id: mongoose.Types.ObjectId(args.swagger.params._id.value) },
      },
      {
        $redact: {
          $cond: {
            if: {
              // This way, if read isn't present, we assume public no roles array.
              $and: [
                { $cond: { if: '$read', then: true, else: false } },
                {
                  $anyElementTrue: {
                    $map: {
                      input: '$read',
                      as: 'fieldTag',
                      in: { $setIsSubset: [['$$fieldTag'], roles] },
                    },
                  },
                },
                // Check if user either has the create-projects role or has project permissions.
                {
                  $cond: {
                    if: { $in: ['public', roles] },
                    then: true,
                    else: {
                      $or: [
                        { $in: ['create-projects', roles] },
                        { $in: [projectKey, userProjectPermissions] },
                      ],
                    },
                  },
                },
              ],
            },
            then: '$$KEEP',
            else: {
              $cond: { if: '$read', then: '$$PRUNE', else: '$$DESCEND' },
            },
          },
        },
      },
    ]);

    if (args.swagger.params._schemaName.value === 'Comment') {
      // Filter
      each(data, (item) => {
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

exports.protectedOptions = (_, res) => {
  defaultLog.info('SEARCH PROTECTED OPTIONS');
  res.status(200).send();
};
