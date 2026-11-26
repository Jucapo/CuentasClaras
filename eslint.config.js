// @ts-check
const eslint = require('@eslint/js');
const { defineConfig, globalIgnores } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const prettier = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  globalIgnores(['dist/', '.angular/', 'coverage/', 'src/app/core/supabase/database.types.ts']),
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    // Design system components (spec §13.1) use the cc- prefix.
    files: ['src/app/shared/ui/**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'cc', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'cc', style: 'kebab-case' },
      ],
    },
  },
  {
    // Spec §13.1: Angular Material is only used inside atoms and molecules.
    files: ['src/app/**/*.ts'],
    ignores: [
      'src/app/shared/ui/atoms/**',
      'src/app/shared/ui/molecules/**',
      'src/app/shared/ui/services/**',
      'src/app/shared/ui/ui.providers.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@angular/material', '@angular/material/*'],
              message:
                'Use a cc- component from shared/ui; Material stays inside atoms and molecules.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
  prettier,
]);
