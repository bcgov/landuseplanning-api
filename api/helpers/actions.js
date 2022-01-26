"use strict";
var { find, isEqual, remove } = require('lodash');

exports.publish = async function (o) {
    return new Promise(function (resolve, reject) {
        try {
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
        } catch (error) {
            reject(error);
        }
    });
};

exports.isPublished = async function (o) {
    return find(o.tags, function (item) {
        return isEqual(item, ['public']);
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
        remove(o.tags, function (item) {
            return isEqual(item, ['public']);
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