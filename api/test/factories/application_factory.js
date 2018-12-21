const factory = require('factory-girl').factory;
const Application = require('../../helpers/models/application');

factory.define('application', Application, {
  code: factory.seq('Application.code', (n) => `app-code-${n}`),
  isDeleted: false,
  internal: {
    tags: [
      ['public'], ['sysadmin']
    ]  
  },
  name: factory.seq('Application.name', (n) => `application-${n}`),
  tags: [
    ['public'], ['sysadmin']
  ], 
});

exports.factory = factory;