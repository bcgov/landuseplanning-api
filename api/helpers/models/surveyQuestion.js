const Schema = require('mongoose').Schema;
const surveyLikert = require('./surveyLikert').schema;

module.exports = require('../models')('SurveyQuestion', {
    type: { type: String, required: true },
    answerRequired: { type: Boolean, default: false },
    maxChars: { type: Number },
    choices: [String],
    choose: { type: Number },
    other: { type: String },
    attributes: [surveyLikert],
    questionText: { type: String },
    infoText: { type: String },
    docPickerText: { type: String },
    emailText: { type: String},
    phoneNumberText: { type: String }
}, 'lup');