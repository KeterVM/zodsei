import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: { index: 'src/index.ts', 'vue-query': 'src/vue-query/index.ts' },
    format: 'esm',
    dts: true,
    sourcemap: true,
    target: 'es2020',
    fixedExtension: false,
    deps: {
      neverBundle: ['zod', 'axios', 'vue', '@tanstack/vue-query'],
    },
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/fixtures/'],
    },
  },
  fmt: {
    semi: true,
    trailingComma: 'es5',
    singleQuote: true,
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
  },
  lint: {
    plugins: ['typescript'],
    categories: {
      correctness: 'error',
    },
    options: {
      typeAware: true,
      maxWarnings: 0,
      typeCheck: true,
    },
    rules: {
      'eslint/no-unused-vars': [
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
      'typescript/no-explicit-any': 'error',
      'typescript/no-deprecated': 'error',
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    overrides: [
      {
        files: ['src/index.ts'],
        rules: {
          'typescript/no-deprecated': 'off',
        },
      },
      {
        files: ['**/*.test.ts', '**/*.spec.ts'],
        rules: {
          'eslint/no-unused-expressions': 'off',
          'typescript/no-deprecated': 'off',
        },
      },
      {
        files: ['examples/**/*.ts', '*.config.ts', '*.config.js', '*.config.mjs'],
        rules: {
          'eslint/no-unused-vars': 'off',
          'typescript/no-deprecated': 'off',
        },
      },
    ],
    ignorePatterns: ['dist/**', 'node_modules/**', 'coverage/**', '*.d.ts', '.vitest/**'],
    jsPlugins: [
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin',
      },
    ],
  },
});
