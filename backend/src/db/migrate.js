import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sql from 'mssql';
import { config } from '../config.js';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations/', import.meta.url));

async function ensureDatabase() {
  // Connect to master to CREATE DATABASE if missing.
  const master = await new sql.ConnectionPool({
    server: config.db.server,
    port: config.db.port,
    database: 'master',
    user: config.db.user,
    password: config.db.password,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
  try {
    const safeName = config.db.database.replace(/]/g, ']]');
    await master.request().query(`
      IF DB_ID(N'${config.db.database.replace(/'/g, "''")}') IS NULL
        CREATE DATABASE [${safeName}]
    `);
  } finally {
    await master.close();
  }
}

async function ensureMigrationsTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo._migrations', 'U') IS NULL
    BEGIN
      CREATE TABLE _migrations (
        id          NVARCHAR(200) NOT NULL PRIMARY KEY,
        hash        NVARCHAR(64)  NOT NULL,
        applied_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END
  `);
}

function hashContent(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function listMigrations() {
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .sort();
}

async function readApplied(pool) {
  const r = await pool.request().query('SELECT id, hash FROM _migrations');
  const map = new Map();
  for (const row of r.recordset) map.set(row.id, row.hash);
  return map;
}

async function applyMigration(pool, id, body) {
  // mssql doesn't allow GO; split on lines that are exactly "GO".
  const batches = body
    .split(/^\s*GO\s*$/im)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const batch of batches) {
      await new sql.Request(tx).batch(batch);
    }
    await new sql.Request(tx)
      .input('id', sql.NVarChar(200), id)
      .input('hash', sql.NVarChar(64), hashContent(body))
      .query('INSERT INTO _migrations (id, hash) VALUES (@id, @hash)');
    await tx.commit();
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
}

async function main() {
  console.log(`[migrate] target database: ${config.db.database}`);
  await ensureDatabase();

  const pool = await new sql.ConnectionPool({
    server: config.db.server,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();

  try {
    await ensureMigrationsTable(pool);
    const applied = await readApplied(pool);
    const files = await listMigrations();

    let applyCount = 0;
    for (const file of files) {
      const id = path.basename(file, '.sql');
      const body = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      const recordedHash = applied.get(id);
      const currentHash = hashContent(body);

      if (recordedHash === undefined) {
        console.log(`[migrate] applying ${id}`);
        await applyMigration(pool, id, body);
        applyCount++;
      } else if (recordedHash !== currentHash) {
        throw new Error(
          `[migrate] hash mismatch for ${id}: file changed after being applied. ` +
            `Create a new migration instead of editing existing ones.`,
        );
      }
    }

    console.log(`[migrate] done. applied ${applyCount} migration(s).`);
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[migrate] failed:', err.message);
  process.exit(1);
});
