// Vitest globalSetup.
//
// Integration tests need MSSQL up. To skip them (e.g. for syntax-only or
// unit-only runs without docker), set RUN_DB_TESTS=0. Default: 1.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export default async function setup() {
  process.env.NODE_ENV = 'test';

  if (process.env.RUN_DB_TESTS === '0' || process.env.RUN_DB_TESTS === 'false') {
    console.log('[test setup] RUN_DB_TESTS=0 — skipping migrations.');
    return;
  }

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
