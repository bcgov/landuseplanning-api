var _ = require('lodash');
var defaultLog = require('winston').loggers.get('default');
var mongoose = require('mongoose');
var Actions = require('../helpers/actions');
var Utils = require('../helpers/utils');
const csv = require('csv');
const transform = require('stream-transform');

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

// Export survey responses for a given survey
exports.protectedExport = async function (args, res, next) {
  const period = args.swagger.params.periodId.value;

  const match = {
    _schemaName: 'SurveyResponse',
    period: mongoose.Types.ObjectId(period)
  };

  // match by survey if included as a route parameter
  if (args.swagger.params.surveyId) {
    const survey = args.swagger.params.surveyId.value || null;
    survey ? match['survey'] = mongoose.Types.ObjectId(survey) : null
  }

  // Most recent survey response at the top
  const sort = {
    dateAdded: -1
  }

  // Define aggregation stages
  const aggregation = [
    {
      $match: match
    },
    {
      $sort: sort
    }
  ];

  const data = mongoose.model('SurveyResponse')
    .aggregate(aggregation)
    .cursor()
    .exec();

  const filename = `export_${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-disposition', `attachment; filename=${filename}`);
  res.writeHead(200, { 'Content-Type': 'text/csv' });

  res.flushHeaders();

  data.pipe(transform(function (d) {
      delete d._schemaName;
      delete d.delete;
      delete d.read;
      delete d.write;
      delete d.dateAdded;
      delete d.period;
      delete d.project;
      delete d.survey;
      delete d.__v;
      delete d._id;

      d['responseId'] = d.commentId;

      delete d.commentId;
      
      for (let i = 0; i < d.responses.length; i++) {
        let question = d.responses[i].question.questionText ||
        d.responses[i].question.phoneNumberText ||
        d.responses[i].question.emailText || null;
        let answer;

        if (d.responses[i].answer.textAnswer) {
          answer = d.responses[i].answer.textAnswer;
        } else if (d.responses[i].answer.singleChoice) {
          if (d.responses[i].answer.otherText) {
            answer = d.responses[i].answer.otherText;
          } else {
            answer = d.responses[i].answer.singleChoice;
          }
        } else if (d.responses[i].answer.multiChoices.length !== 0) {
          let multiChoiceArray = d.responses[i].answer.multiChoices;
          if (d.responses[i].answer.otherText) {
            multiChoiceArray.push(d.responses[i].answer.otherText)
          }
          answer = multiChoiceArray.join(', ')
        } else if (d.responses[i].answer.attributeChoices.length !== 0) {
          let attributesArray = d.responses[i].question.attributes;
          let attributeChoices = d.responses[i].answer.attributeChoices;
          attributeChoiceArray = _.zipWith(attributesArray, attributeChoices, (a, b) => {
            return a.attribute + ': ' + b;
          })
          answer = attributeChoiceArray.join(', ');
        } else if (d.responses[i].answer.emailAnswer) {
          answer = d.responses[i].answer.emailAnswer;
        } else if (d.responses[i].answer.phoneNumberAnswer) {
          answer = d.responses[i].answer.phoneNumberAnswer;
        } else {

        }

        if (question !== null) {
          d[question] = answer;
        }
      }
      delete d.responses;

      // Translate documents into links.
      const docLinks = [];
      if (d.documents) {
        d.documents.map((theDoc) => {
          docLinks.push('https://landuseplanning.gov.bc.ca/api/document/' + theDoc + '/fetch');
        });
      }

      delete d.documents;

      return { documents: docLinks, ...d };
      
    }))
    .pipe(csv.stringify({ header: true }))
    .pipe(res);
}