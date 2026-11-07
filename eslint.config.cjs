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
    rules: {
      // Zod's idiom is a schema and its type sharing a name (`const Noun` + `type Noun`).
      // TypeScript itself already rejects real redeclarations.
      '@typescript-eslint/no-redeclare': 'off',
    },
  },
  {
    rules: {
      'react/jsx-filename-extension': [
        2,
        { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
      ],
      'max-len': ['warn', { code: 120 }],
      // Unlike cjhin.es: relative imports always carry their extension ('./schema.ts'). Vite's
      // upcoming native config loader requires it for everything vite.config.ts imports, and
      // one rule everywhere beats two styles.
      'import/extensions': ['error', 'ignorePackages'],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
]);
