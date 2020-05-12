const Schema = require('mongoose').Schema;

module.exports = require('../models')('SurveyQuestionAnswer', {
    textAnswer: { type: String },
    singleChoice: { type: String },
    multiChoices: [String],
    attributeChoices: [String],
    otherText: {type: String},
    emailAnswer: {type: String},
    phoneNumberAnswer: {type: String},
}, 'lup');