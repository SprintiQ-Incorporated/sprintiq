/**
 * Custom ESLint Rules for SprintIQ
 *
 * Local plugin that provides project-specific linting rules.
 */

module.exports = {
  rules: {
    'no-raw-fetch-api': require('./no-raw-fetch-api'),
  },
};
