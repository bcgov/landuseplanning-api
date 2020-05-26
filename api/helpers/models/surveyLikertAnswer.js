const Schema = require('mongoose').Schema;

module.exports = require('../models')('SurveyLikertAnswer', {
    choice: {type: String}
}, 'lup');
