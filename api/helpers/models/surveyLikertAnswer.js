module.exports = require('../models')(
  'SurveyLikertAnswer',
  {
    choice: { type: String },
  },
  'lup',
);
