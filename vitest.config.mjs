import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: [
      'js/managers/**/*.test.js',
      'tests/smoke/**/*.test.mjs',
    ],
    exclude: ['node_modules/**', 'dist/**', 'tools/**'],
    environment: 'node',
    globals: false,
  },
});
