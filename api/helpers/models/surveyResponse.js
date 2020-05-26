const mongoose = require('mongoose');
const surveyQuestion = require('./surveyQuestion').schema;
const surveyQuestionAnswer = require('./surveyQuestionAnswer').schema;


module.exports = require('../models')('SurveyResponse', {
    dateAdded                   : { type: Date },
    project                     : { type: 'ObjectId', ref: 'Project '},
    period                      : { type: 'ObjectId', ref: 'CommentPeriod', default: null, index: true  },
    survey                      : { type: 'ObjectId', ref: 'Survey' },
    documents                   : [{ type: 'ObjectId', ref: 'Document', default: null, index: true }],
    author                      : { type: String },
    location                    : { type: String },
    responses                   : [{ question: surveyQuestion, answer: surveyQuestionAnswer }],

    // Number auto-incremented.  Do not set manually.
    commentId                   : { type: Number, default: null },

    // Permissions
    read                : [{ type: String, trim: true, default: 'sysadmin' }],
    write               : [{ type: String, trim: true, default: 'sysadmin' }],
    delete              : [{ type: String, trim: true, default: 'sysadmin' }]
}, 'lup');