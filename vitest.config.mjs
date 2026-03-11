import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests: managers only (vitest format)
    include: ['js/managers/**/*.test.js'],
    // Smoke tests will be added here after Phase 18 migration
    // exclude node_modules, dist, tools
    exclude: ['node_modules/**', 'dist/**', 'tools/**'],
    environment: 'node',
    globals: false,
  },
});
