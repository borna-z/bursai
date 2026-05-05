// V0 ESLint flat config for the mobile RN app.
//
// ESLint v8.57+ defaults to flat config when an `eslint.config.js` is present,
// so this file takes precedence over the legacy `.eslintrc.*` lookup. We use
// flat because the root web project (`eslint.config.js` at repo root) already
// uses flat — staying on the same format avoids the ESLint config-resolution
// surprises we'd hit if a future reviewer ran lint from the repo root.
//
// Per `docs/launch/waves/m-v0-ci-foundations.md`: pragmatic disables are
// allowed when they conflict with the existing codebase, but never disable
// `no-unused-vars`, `no-undef`, or `@typescript-eslint/no-explicit-any` —
// those are load-bearing for the V0 lint gate.

const expoConfig = require('eslint-config-expo/flat');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  ...expoConfig,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // Required by the V0 wave — must stay enabled.
      'no-unused-vars': 'off', // handled by @typescript-eslint/no-unused-vars
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-undef': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      // Pragmatic disables — RN ecosystem noise.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // React Native <Text> does NOT decode HTML entities, so escaping
      // apostrophes/quotes as &rsquo; / &ldquo; would render the entity
      // literally on-screen. The rule is a DOM-only lint and is unsafe
      // here; disable it for the whole RN tree.
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      '.expo/',
      'ios/',
      'android/',
      'babel.config.js',
      'metro.config.js',
      '*.config.js',
      'eslint.config.js',
    ],
  },
];
