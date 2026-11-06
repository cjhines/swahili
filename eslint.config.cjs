// Same base as the cjhin.es frontend (universe + typescript-eslint + prettier).
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const { defineConfig, globalIgnores } = require('eslint/config');
const universeWeb = require('eslint-config-universe/flat/web');

module.exports = defineConfig([
  globalIgnores([
    'dist/',
    'playwright-report/',
    'test-results/',
    'blob-report/',
  ]),
  universeWeb,
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [tsPlugin.configs['flat/recommended']],
  },
  {
    rules: {
      'react/jsx-filename-extension': [
        2,
        { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
      ],
      'max-len': ['warn', { code: 120 }],
      'import/extensions': [
        'error',
        'ignorePackages',
        { js: 'never', jsx: 'never', ts: 'never', tsx: 'never' },
      ],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
]);
