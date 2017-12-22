'use strict';

var orglist = require('./orglist.json');
var mongoose = require('mongoose');
// // var Organization = require('../api/helpers/models/organization');
// var User = require('../api/helpers/models/user');
var User = mongoose.model('User');
var Organization = mongoose.model('Organization');

module.exports = function () {

	return new Promise(function (resolve, reject) {
		var entries = [];
		var count = 0;

		var doUserWork = function (organization, _addedBy) {
			return new Promise(function (resolve, reject) {
				// var fo = findOne('users', { username: _addedBy });
				User.findOne({ username: _addedBy }, function (err, res) {
					if (res !== null) {
						// assume user exists!
						organization.setAuditFields(res);
						organization.save().then(resolve, reject);
					} else {
                        reject(Error('User does not exist'));
					}
				});
			});
		};

		var doOrgWork = function (item) {
			return new Promise(function (resolve, reject) {
				Organization.findOne({ name: item.name }, function (err, res) {
					if (res === null) {
						// assume organization doesn't exist!
						count++;
						var o = new Organization(item);
						o.save().then(resolve, reject);
					} else {
                        reject(Error('Organization already exists'));
					}
				});
			});
		};

		// build list of entries
		orglist.forEach(function (item, index) {
			entries.push(item);
		});

		// resolve promises
		Promise.resolve()
			.then(function () {
				return entries.reduce(function (previousItem, currentItem) {
					console.log('entry=', currentItem);
					return previousItem.then(function () {
						currentItem.tags = [
                            ['public'],
                            ['admin']
                        ];
						return doOrgWork(currentItem)
							//
							// Sequential reduction of work moving from the tail of the original promise
							// array to the head, by returning a promise for the next 'then' clause each time
							// until the final then completes. Only then will this promise reduction 
							// finally resolve for the .then of the original resolving Promise.resolve().
							//
							.then(function (organization) {
								return doUserWork(organization, currentItem._addedBy);
							});
					});
				}, Promise.resolve());
			})
			.then(function () {
				console.log('Organizations loaded:', count);
			})
			.then(resolve, reject)
			.catch(function (err) {
				console.error('Error loading organizations:', err);
			});
	});

};
