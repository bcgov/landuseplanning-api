"use strict";
var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');

exports.publish = async function (o) {
    return new Promise(function (resolve, reject) {
        // Object wasn't already published?
        if (!o.read.includes('public')) {
            var newReadArray = o.read;
            newReadArray.push('public');
            o.read = newReadArray;
            // Remove publish, save then return.
            resolve(o.save());
        } else {
            resolve(o);
        }
    });
};

exports.isPublished = async function (o) {
    return _.find(o.tags, function (item) {
        return _.isEqual(item, ['public']);
    });
};

exports.unPublish = async function (o) {
    return new Promise(function (resolve, reject) {
        // Object wasn't already published?
        if (o.read.includes('public')) {
            var newReadArray = o.read.filter(perms => perms !== 'public');
            o.read = newReadArray;
            // Remove publish, save then return.
            resolve(o.save());
        } else {
            resolve(o);
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
            reject({ code: 400, message: err.message });
        });
    });
};

exports.sendResponse = function (res, code, object) {
    res.writeHead(code, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(object));
};