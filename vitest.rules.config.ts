import { defineConfig } from 'vitest/config';

// Security-rule tests run against the Firebase emulator (see the `test:rules` npm script).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
