const Schema = require('mongoose').Schema;

module.exports = require('../models')('SurveyQuestion', {
    id: { type: String, required: true },
    type: { type: String, required: true },
    questionText: { type: String, required: true },
    answerRequired: { type: Boolean, default: false },
    maxChars: { type: Number, default: 0},
    choices: [String],

}, 'lup');