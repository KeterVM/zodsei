import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts', 'vue-query': 'src/vue-query/index.ts' },
  format: 'esm',
  dts: true,
  sourcemap: true,
  target: 'es2020',
  fixedExtension: false,
  deps: {
    neverBundle: ['zod', 'axios', 'vue', '@tanstack/vue-query'],
  },
});
