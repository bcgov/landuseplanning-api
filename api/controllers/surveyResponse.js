var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');

var getSanitizedFields = function (fields) {
  return _.remove(fields, function (f) {
    return (_.indexOf([
      '_schemaName',
      'author',
      'location',
      'dateAdded',
      'commentPeriod',
      'project',
      'survey',
      'responses',

      'read',
      'write',
      'delete'
    ], f) !== -1);
  });
}

exports.protectedOptions = function (args, res, rest) {
  res.status(200).send();
}

//  Create a new Survey Response
exports.unProtectedPost = async function (args, res, next) {
    var obj = args.swagger.params.surveyResponse.value;
    defaultLog.info('Incoming new object:', obj);
  
    var SurveyResponse = mongoose.model('SurveyResponse');
  
    // get the next commentID for this period
    // var commentIdCount = await getNextCommentIdCount(mongoose.Types.ObjectId(obj.period));
  
    var surveyResponse = new SurveyResponse(obj);
    surveyResponse._schemaName = 'SurveyResponse';
    // surveyResponse.eaoStatus = 'Pending';
    surveyResponse.author = obj.author;
    surveyResponse.response = obj.response;
    surveyResponse.dateAdded = new Date();
    // surveyResponse.isAnonymous = obj.isAnonymous;
    surveyResponse.location = obj.location;
    surveyResponse.commentPeriod = mongoose.Types.ObjectId(obj.commentPeriod);
    // surveyResponse.commentId = commentIdCount;
    // surveyResponse.documents = [];
  
    surveyResponse.read = ['staff', 'sysadmin'];
    surveyResponse.write = ['staff', 'sysadmin'];
    surveyResponse.delete = ['staff', 'sysadmin'];
  
    try {
      var sr = await surveyResponse.save();
      Utils.recordAction('Post', 'SurveyResponse', 'public', sr._id);
      defaultLog.info('Saved new surveyResponse object:', sr);
      return Actions.sendResponse(res, 200, sr);
    } catch (e) {
      defaultLog.info('Error:', e);
      return Actions.sendResponse(res, 400, e);
    }
  };