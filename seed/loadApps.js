'use strict';

var applist = require('./applist.json');
var mongoose = require('mongoose');
var User = mongoose.model('User');
var Application = mongoose.model('Application');

module.exports = function() {
  return new Promise(function(resolve, reject) {
    var entries = [];
    var count = 0;

    var doUserWork = function(application, _createdBy) {
      return new Promise(function(resolve, reject) {
        User.findOne({ username: _createdBy }, function(err, res) {
          if (res !== null) {
            // assume user exists!
            application.setAuditFields(res);
            application.save().then(resolve, reject);
          } else {
            reject(Error('User does not exist'));
          }
        });
      });
    };

    var doApplWork = function(item, query) {
      return new Promise(function(resolve, reject) {
        Application.findOne({ name: item.name }, function(err, res) {
          if (res === null) {
            // assume application doesn't exist!
            count++;

            var a = new Application(item);

            a.save().then(resolve, reject);
          } else {
            reject(Error('Application already exists'));
          }
        });
      });
    };

    // build list of entries
    applist.forEach(function(item, index) {
      entries.push(item);
    });

    // resolve promises
    Promise.resolve()
      .then(function() {
        return entries.reduce(function(previousItem, currentItem) {
          return previousItem.then(function() {
            currentItem.tags = [['public'], ['admin']];
            return (
              doApplWork(currentItem)
                //
                // Sequential reduction of work moving from the tail of the original promise
                // array to the head, by returning a promise for the next 'then' clause each time
                // until the final then completes. Only then will this promise reduction
                // finally resolve for the .then of the original resolving Promise.resolve().
                //
                .then(function(application) {
                  return doUserWork(application, currentItem._createdBy);
                })
            );
          });
        }, Promise.resolve());
      })
      .then(function() {
        console.log('Applications loaded:', count);
      })
      .then(resolve, reject)
      .catch(function(err) {
        console.error('Error loading applications:', err);
      });
  });
};
