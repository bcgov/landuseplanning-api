const factory = require('factory-girl').factory;
const Feature = require('../../helpers/models/feature');

factory.define('feature', Feature, {
  tags: [
    ['public'], ['sysadmin']
  ],
  properties: {
    TENURE_STATUS: 'ACCEPTED',
    TENURE_LOCATION: factory.chance('address'),
    DISPOSITION_TRANSACTION_SID: factory.chance('integer'),
  },
  isDeleted: false,
});

exports.factory = factory;