'use strict';

var doclist = require('./doclist.json');
var mongoose = require('mongoose');
var User = mongoose.model('User');
var Application = mongoose.model('Application');
var Document = mongoose.model('Document');

module.exports = function() {
  return new Promise(function(resolve, reject) {
    var entries = [];
    var count = 0;

    var doUserWork = function(document, _addedBy) {
      return new Promise(function(resolve, reject) {
        User.findOne({ username: _addedBy }, function(err, res) {
          if (res !== null) {
            // assume user exists!
            document.setAuditFields(res);
            document.save().then(resolve, reject);
          } else {
            reject(Error('User does not exist'));
          }
        });
      });
    };

    var doApplWork = function(document, _appl) {
      return new Promise(function(resolve, reject) {
        Application.findOne({ name: _appl }, function(err, res) {
          if (res !== null) {
            // assume application exists!
            document.appl = res;
            document.save().then(resolve, reject);
          } else {
            reject(Error('Application does not exist'));
          }
        });
      });
    };

    var doDocWork = function(item, query) {
      return new Promise(function(resolve, reject) {
        Document.findOne({ documentFileName: item.documentFileName }, function(err, res) {
          if (res === null) {
            // assume document doesn't exist!
            count++;
            var d = new Document(item);
            d.save().then(resolve, reject);
          } else {
            reject(Error('Document already exists'));
          }
        });
      });
    };

    // build list of entries
    doclist.forEach(function(item, index) {
      entries.push(item);
    });

    // resolve promises
    Promise.resolve()
      .then(function() {
        return entries.reduce(function(previousItem, currentItem) {
          return previousItem.then(function() {
            currentItem.tags = [['public'], ['admin']];
            return (
              doDocWork(currentItem)
                //
                // Sequential reduction of work moving from the tail of the original promise
                // array to the head, by returning a promise for the next 'then' clause each time
                // until the final then completes. Only then will this promise reduction
                // finally resolve for the .then of the original resolving Promise.resolve().
                //
                .then(function(document) {
                  return doApplWork(document, currentItem._appl);
                })
                .then(function(document) {
                  return doUserWork(document, currentItem._addedBy);
                })
            );
          });
        }, Promise.resolve());
      })
      .then(function() {
        console.log('Documents loaded:', count);
      })
      .then(resolve, reject)
      .catch(function(err) {
        console.error('Error loading documents:', err);
      });
  });
};
