/**
 * This file needs to be tailored to lint for Javascript code that is
 * compatible with the node version running in the production environment.
 */
module.exports = {
    root: true,
    extends: ["eslint:recommended"],
    globals: {},
    env: {
      node: true,
      es6: true,
    },
    parserOptions: {
      ecmaFeatures: {},
      ecmaVersion: 6,
      sourceType: "module",
    },
};