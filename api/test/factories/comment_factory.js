const factory = require('factory-girl').factory;
const Comment = require('../../helpers/models/comment');

factory.define('comment', Comment, buildOptions => {
  let attrs = {
    code: factory.seq('Comment.code', (n) => `comment-code-${n}`),
    comment: factory.chance('sentence'),
    name: factory.chance('name'),
    isDeleted: false,
    tags: [
      ['public'], ['sysadmin']
    ], 
  }
  if (buildOptions.public) { 
    attrs.tags = [['public'], ['sysadmin']];
  } else if (buildOptions.public === false) {
    attrs.tags = [['sysadmin']];
  }
  return attrs;
});

exports.factory = factory;