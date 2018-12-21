const factory = require('factory-girl').factory;
const CommentPeriod = require('../../helpers/models/commentperiod');

factory.define('commentperiod', CommentPeriod, buildOptions => {
  let attrs = {
    code: factory.seq('CommentPeriod.code', (n) => `comment-code-${n}`),
    comment: factory.chance('sentence'),
    name: factory.chance('name'),
    isDeleted: false,
    tags: [
      ['public'], ['sysadmin']
    ], 
  };
  if (buildOptions.public) { 
    attrs.tags = [['public'], ['sysadmin']];
  } else if (buildOptions.public === false) {
    attrs.tags = [['sysadmin']];
  }
  return attrs;
});

exports.factory = factory;