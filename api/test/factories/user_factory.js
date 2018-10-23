const factory = require('factory-girl').factory;
const User = require('../../helpers/models/user');

factory.define('user', User, {
  displayName: factory.chance('name'),
  firstName: factory.chance('name'),
  lastName: factory.chance('name'),
  username: factory.seq('User.username', (n) => `test-user-${n}`),
  password: 'V3ryS3cr3tPass',
  roles: [['public']]
});

exports.factory = factory;