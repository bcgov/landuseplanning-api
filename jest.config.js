module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '<rootDir>/api/test/**/*.test.js',
    '<rootDir>/api/test/**/*.spec.js',
  ],
  maxWorkers: 1,
  moduleDirectories: ['node_modules', '<rootDir>'],
  transform: {}
};
