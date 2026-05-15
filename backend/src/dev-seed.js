// Dev-only: insert a handful of mixed-state appointments and a couple of
// boss users so the UI has something to render. Idempotent in the sense
// that re-running it just adds more rows; it does not deduplicate.
//
// Run with: cd backend && node --env-file=../.env src/dev-seed.js

import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import sql from 'mssql';
import { getPool, closePool } from './db/pool.js';
import { config } from './config.js';

if (config.isProduction) {
  console.error('Refusing to run dev-seed in production (NODE_ENV=production).');
  process.exit(1);
}

async function ensureUser(pool, { username, display_name, role, password = 'changeme' }) {
  const existing = await pool
    .request()
    .input('u', sql.NVarChar(50), username)
    .query('SELECT id FROM users WHERE username = @u AND deleted_at IS NULL');
  if (existing.recordset.length > 0) return existing.recordset[0].id;

  const id = `u_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const hash = await bcrypt.hash(password, config.bcryptRounds);
  await pool
    .request()
    .input('id', sql.NVarChar(50), id)
    .input('display_name', sql.NVarChar(200), display_name)
    .input('username', sql.NVarChar(50), username)
    .input('hash', sql.NVarChar(200), hash)
    .input('role', sql.NVarChar(20), role)
    .query(
      `INSERT INTO users (id, display_name, username, password_hash, role)
       VALUES (@id, @display_name, @username, @hash, @role)`,
    );
  console.log(`[dev-seed] created ${role} ${username}`);
  return id;
}

async function insertAppt(pool, { sec_id, boss, last, status = 'pending', urgent = 0, offsetDays = 0, cause = 'work' }) {
  const r = await pool
    .request()
    .input('first', sql.NVarChar(100), 'Demo')
    .input('last', sql.NVarChar(100), last)
    .input('boss', sql.NVarChar(20), boss)
    .input('cause', sql.NVarChar(50), cause)
    .input('urgent', sql.Bit, urgent)
    .input('status', sql.NVarChar(20), status)
    .input('off', sql.Int, offsetDays)
    .query(`
      INSERT INTO appointments
        (visitor_type, visitor_first_name, visitor_last_name, boss_id, cause_id, urgent, visit_date, status)
      OUTPUT INSERTED.id
      VALUES ('guest', @first, @last, @boss, @cause, @urgent,
        DATEADD(day, @off, CAST(GETDATE() AS DATE)), @status)
    `);
  const id = r.recordset[0].id;
  await pool
    .request()
    .input('id', sql.Int, id)
    .input('uid', sql.NVarChar(50), sec_id)
    .query(`INSERT INTO appointment_history (appointment_id, action, user_id) VALUES (@id, 'create', @uid)`);
  return id;
}

async function main() {
  const pool = await getPool();

  const sec = await ensureUser(pool, { username: 'sec1', display_name: 'Демо Секретарь', role: 'secretary' });
  await ensureUser(pool, { username: 'b1', display_name: 'Демо Босс 1', role: 'boss1' });
  await ensureUser(pool, { username: 'b2', display_name: 'Демо Босс 2', role: 'boss2' });
  await ensureUser(pool, { username: 'b3', display_name: 'Демо Босс 3', role: 'boss3' });

  await insertAppt(pool, { sec_id: sec, boss: 'boss1', last: 'Petrov', urgent: 1 });
  await insertAppt(pool, { sec_id: sec, boss: 'boss1', last: 'Atayeva', cause: 'personal' });
  await insertAppt(pool, { sec_id: sec, boss: 'boss2', last: 'Smirnov', status: 'approved' });
  await insertAppt(pool, { sec_id: sec, boss: 'boss3', last: 'Mueller', status: 'rejected' });
  await insertAppt(pool, { sec_id: sec, boss: 'boss1', last: 'Carryover', status: 'approved', offsetDays: -1 });
  await insertAppt(pool, { sec_id: sec, boss: 'boss2', last: 'Future', offsetDays: 2 });

  console.log('[dev-seed] done. Seeded users use password "changeme".');
  await closePool();
}

main().catch(async (err) => {
  console.error('[dev-seed] failed:', err.message);
  await closePool().catch(() => {});
  process.exit(1);
});
