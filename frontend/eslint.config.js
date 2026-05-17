// =====================================================================
// eslint.config.js – ESLint-Konfiguration für ES Modules
// =====================================================================

export default [
  {
    files: ['**/*.js'],
    ignores: ['vendor/**'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        caches: 'readonly',
        self: 'readonly',
        console: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off'
    }
  }
];

// Ende eslint.config.js
