"use strict";
var _           = require('lodash');
var defaultLog  = require('winston').loggers.get('default');

exports.publish = function (o) {
    return new Promise(function (resolve, reject) {
        var exists = _.find(o.tags, function (item) {
            return _.isEqual(item, ['public']);
        });

        // Object was already published?
        if (exists) {
            defaultLog.info("HTTP 409, Object already published:", exists);
            reject({
                code: 409,
                message: "Object already published" }
            );
        } else {
            // Add publish, save then return.
            o.tags.push(["public"]);
            o.save().then(resolve, function (err) {
                reject({code: 400, message: err.message});
            });
        }
    });
};

exports.isPublished = function (o) {
    return _.find(o.tags, function (item) {
        return _.isEqual(item, ['public']);
    });
};

exports.unPublish = function (o) {
    return new Promise(function (resolve, reject) {
        var exists = _.remove(o.tags, function (item) {
            return _.isEqual(item, ['public']);
        });
        // Object wasn't already published?
        if (exists.length === 0) {
            defaultLog.info("HTTP 409, Object already unpublished:", exists);
            reject({
                code: 409,
                message: "Object already unpublished" }
            );
        } else {
            o.markModified('tags');
            // Remove publish, save then return.
            o.save().then(resolve, function (err) {
                reject({code: 400, message: err.message});
            });
        }
    });
};

exports.delete = function (o) {
    return new Promise(function (resolve, reject) {
        _.remove(o.tags, function (item) {
            return _.isEqual(item, ['public']);
        });
        o.isDeleted = true;
        o.markModified('tags');
        o.markModified('isDeleted');
        // save then return.
        o.save().then(resolve, function (err) {
            reject({code: 400, message: err.message});
        });
    });
};

exports.sendResponse = function (res, code, object) {
    res.writeHead(code, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(object));
};