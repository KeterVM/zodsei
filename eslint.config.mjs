// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Apply recommended rules from ESLint
  eslint.configs.recommended,

  // Apply recommended TypeScript ESLint rules
  ...tseslint.configs.recommended,

  // Global configuration for all files
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },

  // Configuration for test files
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      // Allow any in test files for mocking
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow unused expressions in tests (for expect statements)
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },

  // Configuration for example files
  {
    files: ['examples/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: false, // Disable TypeScript project for example files
      },
    },
    rules: {
      // Relax rules for example files
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // Configuration for JavaScript files (if any)
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      parserOptions: {
        project: false, // Disable TypeScript project for JS files
      },
    },
    rules: {
      // Disable TypeScript-specific rules for JS files
      '@typescript-eslint/no-var-requires': 'off',
    },
  },

  // Ignore patterns
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.d.ts', '.vitest/**'],
  }
);
