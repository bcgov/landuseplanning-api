const Schema = require('mongoose').Schema;

module.exports = require('../models')('SurveyQuestionAnswer', {
    textAnswer: { type: String },
    singleChoiceAnswer: { type: String },
    multiChoiceAnswers: [String],
    likertAnswers: [String],
    otherText: {type: String},
}, 'lup');