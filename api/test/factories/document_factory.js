const factory = require('factory-girl').factory;
const Document = require('../../helpers/models/document');

factory.define('document', Document, buildOptions => {
  let attrs = {
    displayName: factory.chance('name'),
    documentFileName: factory.seq('Document.documentFileName', (n) => `test-document-${n}.docx`),
    internalURL: './api/test/fixtures/test_document.txt',
    tags: [['sysadmin']]
  };
  
  if (buildOptions.public) {
    attrs.tags = [['public'], ['sysadmin']];
  } else if (buildOptions.public === false) {
    attrs.tags = [['sysadmin']];
  }
  return attrs;
});

exports.factory = factory;