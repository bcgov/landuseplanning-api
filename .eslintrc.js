/**
 * This file needs to be tailored to lint for Javascript code that is
 * compatible with the node version running in the production environment.
 */
module.exports = {
  root: true,
  extends: ['eslint:recommended'],
  globals: {},
  env: {
    node: true,
    es6: true,
    jest: true,
  },
  parserOptions: {
    ecmaFeatures: {},
    ecmaVersion: 2018,
    sourceType: 'script',
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js', '**/__tests__/**/*.[jt]s?(x)'],
      env: { jest: true },
      plugins: ['jest'],
      extends: ['plugin:jest/recommended'],
    },
  ],
};