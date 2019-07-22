var auth = require("../helpers/auth");
var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');
var tagList = [
    'listName',
    'items'
];

var getSanitizedFields = function (fields) {
    return _.remove(fields, function (f) {
        return (_.indexOf(tagList, f) !== -1);
    });
}

exports.protectedOptions = function (args, res, rest) {
    res.status(200).send();
};

//  Create a new topic
exports.protectedPost = async function (args, res, next) {
    var obj = args.swagger.params.topic.value;

    defaultLog.info("Incoming new object:", obj);

    var Topic = mongoose.model('Topic');
    var topic = new Topic(obj);
    topic._schemaName = 'Topic';
    topic.read = ['project-system-admin']

    // Change this to use guid instead of idir/user
    topic._addedBy = args.swagger.params.auth_payload.preferred_username;

    // Define security tag defaults
    var theTopic = await topic.save()
    Utils.recordAction('Post', 'List', args.swagger.params.auth_payload.preferred_username, theTopic._id);
    return Actions.sendResponse(res, 200, theTopic);
};

exports.protectedGet = async function (args, res, next) {
    var skip = null, limit = null, sort = {}, query = {};

    if (args.swagger.params.topicId && args.swagger.params.topicId.value) {
        query = Utils.buildQuery("_id", args.swagger.params.topicId.value, query);
    }
    if (args.swagger.params.sortBy && args.swagger.params.sortBy.value) {
        args.swagger.params.sortBy.value.forEach(function (value) {
            var order_by = value.charAt(0) == '-' ? -1 : 1;
            var sort_by = value.slice(1);
            sort[sort_by] = order_by;
        }, this);
    }
    var processedParameters = Utils.getSkipLimitParameters(args.swagger.params.pageSize, args.swagger.params.pageNum);
    skip = processedParameters.skip;
    limit = processedParameters.limit;

    // Set query type
    _.assignIn(query, { "_schemaName": "Topic" });

    var data = await Utils.runDataQuery('Topic',
        args.swagger.params.auth_payload.realm_access.roles,
        query,
        getSanitizedFields(args.swagger.params.fields.value), // Fields
        null, // sort warmup
        sort, // sort
        skip, // skip
        limit, // limit
        true) // count
    Utils.recordAction('Get', 'List', args.swagger.params.auth_payload.preferred_username, args.swagger.params.topicId && args.swagger.params.topicId.value ? args.swagger.params.topicId.value : null);
    return Actions.sendResponse(res, 200, data);
};

exports.protectedPut = async function (args, res, next) {
    var objId = args.swagger.params.topicId.value;
    defaultLog.info("ObjectID:", args.swagger.params.topicId.value);
    var obj = args.swagger.params.cp.value;

    // Strip security tags - these will not be updated on this route.
    delete obj.tags;

    defaultLog.info("Incoming updated object:", obj);

    var topic = require('mongoose').model('Topic');

    // Change this to use guid instead of idir/user
    topic._updatedBy = args.swagger.params.auth_payload.preferred_username;

    var data = await topic.findOneAndUpdate({ _id: objId }, obj, { upsert: false, new: true }).exec();
    Utils.recordAction('Put', 'List', args.swagger.params.auth_payload.preferred_username, data._id);
    return Actions.sendResponse(res, 200, data);
}

exports.protectedDelete = async function (args, res, next) {
    var objId = args.swagger.params.topicId.value;
    defaultLog.info("Delete Topic:", objId);

    var topic = require('mongoose').model('Topic');

    // Change this to use guid instead of idir/user
    topic._deletedBy = args.swagger.params.auth_payload.preferred_username;

    var data = await topic.remove({ _id: objId }).exec();
    Utils.recordAction('Delete', 'List', args.swagger.params.auth_payload.preferred_username, data._id);
    return Actions.sendResponse(res, 200, data);
};
