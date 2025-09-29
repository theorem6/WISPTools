module.exports = {
  root: true,
  extends: ['eslint:recommended', './.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'svelte'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2020,
  },
  env: {
    browser: true,
    es2017: true,
    node: true
  },
  ignorePatterns: ['dist']
};
