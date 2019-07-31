var auth = require("../helpers/auth");
var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');
var tagList = [
    'code',
    'description',
    'name',
    'parent',
    'pillar',
    'project',
    'stage',
    'title',
    'type'
];

var getSanitizedFields = function (fields) {
    return _.remove(fields, function (f) {
        return (_.indexOf(tagList, f) !== -1);
    });
}

exports.protectedOptions = function (args, res, rest) {
    res.status(200).send();
};

//  Create a new vc
exports.protectedPost = async function (args, res, next) {
    var obj = args.swagger.params.vc.value;

    defaultLog.info("Incoming new object:", obj);

    var Vc = mongoose.model('Vc');
    var vc = new Vc(obj);
    console.log("***************************************************");
    console.log(vc);
    console.log("***************************************************");
    vc._schemaName = 'Vc';
    vc.read = ['public', 'project-system-admin', 'staff'];
    vc.write = ['project-system-admin', 'staff'];
    vc.delete = ['project-system-admin', 'staff'];

    // Define security tag defaults
    var theVc = await vc.save()
    Utils.recordAction('Post', 'Vc', args.swagger.params.auth_payload.preferred_username, theVc._id);
    return Actions.sendResponse(res, 200, theVc);
};

exports.protectedGet = async function (args, res, next) {
    var skip = null, limit = null, sort = {};
    var query = {};

    if (args.swagger.params.vcId && args.swagger.params.vcId.value) {
        query = Utils.buildQuery("_id", args.swagger.params.vcId.value, query);
    }
    if (args.swagger.params.projectId && args.swagger.params.projectId.value) {
        _.assignIn(query, { project: mongoose.Types.ObjectId(args.swagger.params.projectId.value) });
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
    _.assignIn(query, { "_schemaName": "Vc" });

    var data = await Utils.runDataQuery('Vc',
        args.swagger.params.auth_payload.realm_access.roles,
        query,
        getSanitizedFields(args.swagger.params.fields.value), // Fields
        null, // sort warmup
        sort, // sort
        skip, // skip
        limit, // limit
        true) // count
    Utils.recordAction('Get', 'Vc', args.swagger.params.auth_payload.preferred_username, args.swagger.params.vcId && args.swagger.params.vcId.value ? args.swagger.params.vcId.value : null);
    return Actions.sendResponse(res, 200, data);
};

exports.protectedPut = async function (args, res, next) {
    var objId = args.swagger.params.vcId.value;
    defaultLog.info("ObjectID:", args.swagger.params.vcId.value);
    var obj = args.swagger.params.cp.value;

    // Strip security tags - these will not be updated on this route.
    delete obj.tags;

    defaultLog.info("Incoming updated object:", obj);

    var valuedComponent = require('mongoose').model('Vc');
    var data = await valuedComponent.findOneAndUpdate({ _id: objId }, obj, { upsert: false, new: true }).exec();
    Utils.recordAction('Put', 'Vc', args.swagger.params.auth_payload.preferred_username, objId);
    return Actions.sendResponse(res, 200, data);
}

exports.protectedDelete = async function (args, res, next) {
    var objId = args.swagger.params.vcId.value;
    defaultLog.info("Delete Vc:", objId);

    var commentperiod = require('mongoose').model('Vc');
    var data = await commentperiod.remove({ _id: objId }).exec();
    Utils.recordAction('Delete', 'Vc', args.swagger.params.auth_payload.preferred_username, objId);
    return Actions.sendResponse(res, 200, data);
};
