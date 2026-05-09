// Vitest globalSetup. Runs once before the test suite.
// Forces the test database name and ensures migrations are applied.
//
// Per-test cleanup (truncating tables between tests) lives in a fixture
// added later when the first integration test exists.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export default async function setup() {
  process.env.NODE_ENV = 'test';

  const result = spawnSync(
    process.execPath,
    ['--env-file=../.env', 'src/db/migrate.js', '--test'],
    {
      cwd: path.join(REPO_ROOT, 'backend'),
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' },
    },
  );

  if (result.status !== 0) {
    throw new Error(`[test setup] migration failed (exit ${result.status})`);
  }
}
