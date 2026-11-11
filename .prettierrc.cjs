module.exports = {
  arrowParens: 'always',
  bracketSpacing: true,
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
  overrides: [
    {
      // Deck and grammar files read best as tables: one card, subject or form list per line.
      files: '*.yaml',
      options: { printWidth: 120 },
    },
  ],
};
