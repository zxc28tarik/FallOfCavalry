import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: [
      'tests/unit/**/*.test.js',
      'tests/smoke/**/*.test.mjs',
      'js/battle/**/*.test.js',
    ],
    exclude: ['node_modules/**', 'dist/**', 'tools/**'],
    environment: 'node',
    globals: false,
  },
});
