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
      'period',
      'survey',
      'commentId',
      'documents',
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
    const surveyResponseIdCount = await getNextSurveyResponseIdCount(mongoose.Types.ObjectId(obj.period));
  
    var surveyResponse = new SurveyResponse(obj);
    surveyResponse._schemaName = 'SurveyResponse';
    surveyResponse.dateAdded = new Date();
    surveyResponse.author = obj.author;
    surveyResponse.location = obj.location;
    surveyResponse.response = obj.response;
    surveyResponse.surveyResponseIdCount = surveyResponseIdCount;
    surveyResponse.survey = mongoose.Types.ObjectId(obj.survey);
    surveyResponse.project = mongoose.Types.ObjectId(obj.project);
    surveyResponse.period = mongoose.Types.ObjectId(obj.period);
    surveyResponse.documents = [];
    surveyResponse.commentId = surveyResponseIdCount;
  
    surveyResponse.read = ['staff', 'sysadmin'];
    surveyResponse.write = ['staff', 'sysadmin'];
    surveyResponse.delete = ['staff', 'sysadmin'];
  
    try {
      var sr = await surveyResponse.save();
      console.log('SURCEY REAPONEEEEEEEE', sr)
      Utils.recordAction('Post', 'SurveyResponse', 'public', sr._id);
      defaultLog.info('Saved new surveyResponse object:', sr);
      return Actions.sendResponse(res, 200, sr);
    } catch (e) {
      defaultLog.info('Error:', e);
      return Actions.sendResponse(res, 400, e);
    }

};

exports.protectedGet = async function (args, res, next) {
    defaultLog.info('Getting survey response(s)')
  
    var query = {}, sort = {}, skip = null, limit = null, count = false, filter = [];
  
    // Build match query if on surveyResponseId route.
    if (args.swagger.params.surveyResponseId && args.swagger.params.surveyResponseId.value) {
      _.assignIn(query, { _id: mongoose.Types.ObjectId(args.swagger.params.surveyResponseId.value) });
    }

    // Build query if on project's id
    if (args.swagger.params.project && args.swagger.params.project.value) {
      query = Utils.buildQuery('project', args.swagger.params.project.value, query);
    }
  
    // Build match query if on comment period's id
    if (args.swagger.params.period && args.swagger.params.period.value) {
      _.assignIn(query, { period: mongoose.Types.ObjectId(args.swagger.params.period.value) });
    }
  
    // Sort
    if (args.swagger.params.sortBy && args.swagger.params.sortBy.value) {
      args.swagger.params.sortBy.value.forEach(function (value) {
        var order_by = value.charAt(0) == '-' ? -1 : 1;
        var sort_by = value.slice(1);
        sort[sort_by] = order_by;
      }, this);
    }
  
    // Skip and limit
    var processedParameters = Utils.getSkipLimitParameters(args.swagger.params.pageSize, args.swagger.params.pageNum);
    skip = processedParameters.skip;
    limit = processedParameters.limit;
  
    // Count
    if (args.swagger.params.count && args.swagger.params.count.value) {
      count = args.swagger.params.count.value;
    }
  
    // Set query type
    _.assignIn(query, { '_schemaName': 'SurveyResponse' });
  
    // Set filter for eaoStatus
    // if (args.swagger.params.pending && args.swagger.params.pending.value === true) {
    //   filter.push({ 'eaoStatus': 'Pending' });
    // }
    // if (args.swagger.params.published && args.swagger.params.published.value === true) {
    //   filter.push({ 'eaoStatus': 'Published' });
    // }
    // if (args.swagger.params.deferred && args.swagger.params.deferred.value === true) {
    //   filter.push({ 'eaoStatus': 'Deferred' });
    // }
    // if (args.swagger.params.rejected && args.swagger.params.rejected.value === true) {
    //   filter.push({ 'eaoStatus': 'Rejected' });
    // }
    // if (filter.length !== 0) {
    //   _.assignIn(query, { $or: filter });
    // }
  
    try {
      var data = await Utils.runDataQuery('SurveyResponse',
        args.swagger.params.auth_payload.realm_access.roles,
        query,
        getSanitizedFields(args.swagger.params.fields.value), // Fields
        null,
        sort, // sort
        skip, // skip
        limit, // limit
        count); // count
      Utils.recordAction('Get', 'SurveyResponse', args.swagger.params.auth_payload.preferred_username, args.swagger.params.surveyResponseId && args.swagger.params.surveyResponseId.value ? args.swagger.params.surveyResponseId.value : null);
      defaultLog.info('Got survey response(s):', data);
  
      // This is to get the next pending comment information.
    //   if (args.swagger.params.populateNextComment && args.swagger.params.populateNextComment.value) {
    //     defaultLog.info('Getting next pending comment information');
    //     var queryForNextComment = {};
  
    //     _.assignIn(queryForNextComment, { _id: { $ne: data[0]._id } });
    //     _.assignIn(queryForNextComment, { period: data[0].period });
    //     _.assignIn(queryForNextComment, { eaoStatus: 'Pending' });
  
    //     var nextComment = await Utils.runDataQuery('Comment',
    //       args.swagger.params.auth_payload.realm_access.roles,
    //       queryForNextComment,
    //       [], // Fields
    //       null,
    //       { commentId: 1 }, // sort
    //       0, // skip
    //       1, // limit
    //       true); // count
    //     res.setHeader('x-pending-comment-count', nextComment && nextComment.length > 0 ? nextComment[0].total_items : 0);
    //     res.setHeader('x-next-comment-id', nextComment && nextComment.length > 0 && nextComment[0].results.length > 0 ? nextComment[0].results[0]._id : null);
    //   }
      return Actions.sendResponse(res, 200, data);
    } catch (e) {
      defaultLog.info('Error:', e);
      return Actions.sendResponse(res, 400, e);
    }

    
};

async function getNextSurveyResponseIdCount(period) {
  var CommentPeriod = mongoose.model('CommentPeriod');
  var period = await CommentPeriod.findOneAndUpdate({ _id: period }, { $inc: { surveyResponseIdCount: 1 } }, { new: true, useFindAndModify: false  });
  return period.surveyResponseIdCount;
}