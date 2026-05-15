import { defineConfig } from 'vitest/config';

// CI runs without MSSQL by default — set RUN_DB_TESTS=0 to exclude the
// integration suite. Locally with the dev container up, leave RUN_DB_TESTS
// unset (or =1) for the full run.
const skipDb = process.env.RUN_DB_TESTS === '0' || process.env.RUN_DB_TESTS === 'false';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    exclude: skipDb ? ['tests/integration/**', 'node_modules/**'] : ['node_modules/**'],
    globalSetup: ['./tests/setup.js'],
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
