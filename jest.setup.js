// Force defaultLog to have at least one transport during tests
const winston = require('winston');
const defaultLog = require('winston').loggers.get('defaultLog');
const jest = require('jest');

// Ensure TextEncoder/TextDecoder exist (needed by whatwg-url)
const { TextEncoder, TextDecoder } = require('util');

// For Mongo Memory Server 10 management
const { beforeAll, afterAll, afterEach } = require('@jest/globals');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// For importing models
const { globSync } = require('glob');
const path = require('path');

let mongod;
mongoose.set('strictQuery', true);

if (!winston.loggers.has('defaultLog')) {
  winston.loggers.add('defaultLog', {
    silent: true,
    transports: [
      new winston.transports.Console({ silent: true })
    ]
  });
}

if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder;

jest.setTimeout(60000);

beforeAll(async () => {
    mongod = await MongoMemoryServer.create({
        binary: { version: process.env.MONGOMS_VERSION || '5.0.19' },
    });
    await mongoose.connect(mongod.getUri(), { serverSelectionTimeoutMS: 60000 });
    const modelDirPattern = path.join(__dirname, 'api', 'helpers', 'models', '**', '*.js');
    const modelFiles = globSync(modelDirPattern, { nodir: true });

    for (const file of modelFiles) {
        try {
            require(file);
        } catch (e) {
            defaultLog.error('Failed to import model file in Jest setup', {
              status: e && (e.status || e.statusCode),
              file: file,
              err: { name: e && e.name, message: e && e.message, stack: e && e.stack }
            });
            throw e;
        }
    }
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  for (const name of Object.keys(collections)) {
    await collections[name].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});


