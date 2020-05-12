const Schema = require('mongoose').Schema;

module.exports = require('../models')('SurveyLikert', {
    attribute: { type: String },
    choices: [String]
}, 'lup');
