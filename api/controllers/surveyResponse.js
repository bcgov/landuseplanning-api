const { zipWith, indexOf, assignIn, remove } = require('lodash');
const defaultLog = require('winston').loggers.get('defaultLog');
const mongoose = require('mongoose');
const Actions = require('../helpers/actions');
const Utils = require('../helpers/utils');
const csv = require('csv');
const transform = require('stream-transform');

const getSanitizedFields = (fields) => {
  return remove(fields, (f) => {
    return (
      indexOf(
        [
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
          'delete',
        ],
        f,
      ) !== -1
    );
  });
};

exports.protectedOptions = (args, res) => {
  defaultLog.info('SURVEY RESPONSE PROTECTED OPTIONS');
  res.status(200).send();
};

//  Create a new Survey Response
exports.unProtectedPost = async (args, res) => {
  defaultLog.info('SURVEY RESPONSE PUBLIC POST');

  const obj = args.swagger.params.surveyResponse.value;
  defaultLog.info('Incoming new survey response:', obj);

  const SurveyResponse = mongoose.model('SurveyResponse');

  // get the next commentID for this period
  const surveyResponseIdCount = await getNextSurveyResponseIdCount(
    mongoose.Types.ObjectId(obj.period),
  );

  const surveyResponse = new SurveyResponse({
    _schemaName: 'SurveyResponse',
    dateAdded: new Date(),
    author: obj.author,
    location: obj.location,
    responses: obj.responses, // plural
    surveyResponseIdCount: surveyResponseIdCount,
    survey: mongoose.Types.ObjectId(obj.survey),
    project: mongoose.Types.ObjectId(obj.project),
    period: mongoose.Types.ObjectId(obj.period),
    documents: [],
    commentId: surveyResponseIdCount,
    read: ['staff', 'sysadmin'],
    write: ['staff', 'sysadmin'],
    delete: ['staff', 'sysadmin'],
  });

  try {
    const sr = await surveyResponse.save();
    Utils.recordAction('Post', 'SurveyResponse', 'public', sr._id);
    defaultLog.info('Saved new surveyResponse:', sr._id);
    return Actions.sendResponse(res, 200, sr);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

exports.protectedGet = async (args, res) => {
  defaultLog.info('SURVEY RESPONSE GET');
  const params = args.swagger.params;

  let query = {},
    sort = {},
    skip = null,
    limit = null,
    count = false;

  // Build match query if on surveyResponseId route.
  if (params.surveyResponseId && params.surveyResponseId.value) {
    assignIn(query, {
      _id: mongoose.Types.ObjectId(params.surveyResponseId.value),
    });
  }

  // Build query if on project's id
  if (params.project && params.project.value) {
    query = Utils.buildQuery('project', params.project.value, query);
  }

  // Build match query if on comment period's id
  if (params.period && params.period.value) {
    assignIn(query, {
      period: mongoose.Types.ObjectId(params.period.value),
    });
  }

  // Sort
  if (params.sortBy && params.sortBy.value) {
    params.sortBy.value.forEach((value) => {
      const order_by = value.charAt(0) == '-' ? -1 : 1;
      const sort_by = value.slice(1);
      sort[sort_by] = order_by;
    });
  }

  // Skip and limit
  const processedParameters = Utils.getSkipLimitParameters(
    params.pageSize,
    params.pageNum,
  );
  skip = processedParameters.skip;
  limit = processedParameters.limit;

  // Count
  if (params.count && params.count.value) {
    count = params.count.value;
  }

  // Set query type
  assignIn(query, { _schemaName: 'SurveyResponse' });

  try {
    const data = await Utils.runDataQuery(
      'SurveyResponse',
      params.auth_payload.client_roles,
      params.auth_payload.idir_user_guid,
      query,
      getSanitizedFields(params.fields.value), // Fields
      null,
      sort, // sort
      skip, // skip
      limit, // limit
      count,
    ); // count

    Utils.recordAction(
      'Get',
      'SurveyResponse',
      params.auth_payload.preferred_username,
      params.surveyResponseId && params.surveyResponseId.value
        ? params.surveyResponseId.value
        : null,
    );
    defaultLog.info('Got survey response(s):', data);
    return Actions.sendResponse(res, 200, data);
  } catch (e) {
    defaultLog.error(e);
    return Actions.sendResponse(res, 400, e);
  }
};

async function getNextSurveyResponseIdCount(periodId) {
  const CommentPeriod = mongoose.model('CommentPeriod');
  const updatedPeriod = await CommentPeriod.findOneAndUpdate(
    { _id: periodId },
    { $inc: { surveyResponseIdCount: 1 } },
    { new: true },
  );
  return updatedPeriod ? updatedPeriod.surveyResponseIdCount : 0;
}

/**
 * Uses the model of a survey response to give structure
 * to csv rows and columns
 *
 * @param {*} args
 * @param {*} res
 * @param {*} next
 */
exports.protectedExport = async (args, res) => {
  defaultLog.info('SURVEY RESPONSE PROTECTED EXPORT');
  const period = args.swagger.params.periodId.value;

  const match = {
    _schemaName: 'SurveyResponse',
    period: mongoose.Types.ObjectId(period),
  };

  // match by survey if included as a route parameter
  if (args.swagger.params.surveyId) {
    const survey = args.swagger.params.surveyId.value || null;
    if (survey) {
      match['survey'] = mongoose.Types.ObjectId(survey);
    }
  }

  // Most recent survey response at the top
  const sort = { dateAdded: -1 };

  // Define aggregation stages
  const aggregation = [{ $match: match }, { $sort: sort }];

  const dataStream = mongoose
    .model('SurveyResponse')
    .aggregate(aggregation)
    .allowDiskUse(true)
    .cursor({ batchSize: 1000 });

  const filename = `export_${new Date().toISOString().split('T')[0]}.csv`;
  res.setHeader('Content-disposition', `attachment; filename=${filename}`);
  res.writeHead(200, { 'Content-Type': 'text/csv' });
  res.flushHeaders();

  dataStream
    .pipe(
      transform((d) => {
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

        // Loop through all individual answers in a response
        for (let i = 0; i < d.responses.length; i++) {
          const questionHTML =
            (d.responses[i].question && d.responses[i].question.questionText) ||
            (d.responses[i].question &&
              d.responses[i].question.phoneNumberText) ||
            (d.responses[i].question && d.responses[i].question.emailText) ||
            null;

          let question;
          let answer;

          // first strip out question HTML tags, then &nbsp;
          // for easier reading in csv
          if (questionHTML !== null) {
            question = questionHTML
              .replace(/(<([^>]+)>)/gi, ' ')
              .replace(/(&nbsp;)/gi, ' ');
          }

          if (d.responses[i].answer && d.responses[i].answer.textAnswer) {
            answer = d.responses[i].answer.textAnswer;
          } else if (
            d.responses[i].answer &&
            d.responses[i].answer.singleChoice
          ) {
            if (d.responses[i].answer.otherText) {
              answer = d.responses[i].answer.otherText;
            } else {
              answer = d.responses[i].answer.singleChoice;
            }
          } else if (
            d.responses[i].answer &&
            Array.isArray(d.responses[i].answer.multiChoices) &&
            d.responses[i].answer.multiChoices.length !== 0
          ) {
            const multiChoiceArray = d.responses[i].answer.multiChoices.slice();
            if (d.responses[i].answer.otherText) {
              multiChoiceArray.push(d.responses[i].answer.otherText);
            }
            answer = multiChoiceArray.join(', ');
          } else if (
            d.responses[i].answer &&
            Array.isArray(d.responses[i].answer.attributeChoices) &&
            d.responses[i].answer.attributeChoices.length !== 0
          ) {
            const attributesArray =
              d.responses[i].question && d.responses[i].question.attributes
                ? d.responses[i].question.attributes
                : [];
            const attributeChoices = d.responses[i].answer.attributeChoices;
            const attributeChoiceArray = zipWith(
              attributesArray,
              attributeChoices,
              (a, b) => {
                return (a && a.attribute ? a.attribute : '') + ': ' + b;
              },
            );
            answer = attributeChoiceArray.join(', ');
          } else if (
            d.responses[i].answer &&
            d.responses[i].answer.emailAnswer
          ) {
            answer = d.responses[i].answer.emailAnswer;
          } else if (
            d.responses[i].answer &&
            d.responses[i].answer.phoneNumberAnswer
          ) {
            answer = d.responses[i].answer.phoneNumberAnswer;
          }

          // Only attach if question exists (avoid setting d[undefined])
          if (question != null) {
            d[question] = answer;
          }
        }

        delete d.responses;

        // Translate documents into links.
        const docLinks = [];
        if (d.documents) {
          d.documents.forEach((theDoc) => {
            docLinks.push(
              `https://landuseplanning.gov.bc.ca/api/document/${theDoc}/fetch`,
            );
          });
        }

        delete d.documents;

        return { documents: docLinks, ...d };
      }),
    )
    .pipe(csv.stringify({ header: true }))
    .pipe(res);
};
