const mongoose = require('mongoose');
const surveyQuestion = require('./surveyQuestion').schema;
const surveyQuestionAnswer = require('./surveyQuestionAnswer').schema;


module.exports = require('../models')('SurveyResponse', {
    project                     : { type: 'ObjectId', ref: 'Project '},
    commentPeriod               : { type: 'ObjectId', ref: 'CommentPeriod' },
    survey                      : { type: 'ObjectId', ref: 'Survey' },
    answer                      : [{question: surveyQuestion, answer: surveyQuestionAnswer}],

    // Permissions
    read                : [{ type: String, trim: true, default: 'sysadmin' }],
    write               : [{ type: String, trim: true, default: 'sysadmin' }],
    delete              : [{ type: String, trim: true, default: 'sysadmin' }]
}, 'lup');