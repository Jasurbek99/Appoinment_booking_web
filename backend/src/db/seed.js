import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import sql from 'mssql';
import { config } from '../config.js';
import { getPool, closePool } from './pool.js';

const SECRETARY = {
  username: 'sec1',
  display_name: 'Иванова А.А.',
  role: 'secretary',
};

async function main() {
  const password = config.initialSecretaryPassword;
  if (!password) {
    console.error(
      '[seed] INITIAL_SECRETARY_PASSWORD is not set. Set it in .env before running seed.',
    );
    process.exit(1);
  }

  const pool = await getPool();

  const existing = await pool
    .request()
    .input('username', sql.NVarChar(50), SECRETARY.username)
    .query('SELECT id FROM users WHERE username = @username AND deleted_at IS NULL');

  if (existing.recordset.length > 0) {
    console.log(`[seed] secretary user "${SECRETARY.username}" already exists, skipping.`);
    await closePool();
    return;
  }

  const id = `u_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

  await pool
    .request()
    .input('id', sql.NVarChar(50), id)
    .input('display_name', sql.NVarChar(200), SECRETARY.display_name)
    .input('username', sql.NVarChar(50), SECRETARY.username)
    .input('password_hash', sql.NVarChar(200), passwordHash)
    .input('role', sql.NVarChar(20), SECRETARY.role).query(`
      INSERT INTO users (id, display_name, username, password_hash, role)
      VALUES (@id, @display_name, @username, @password_hash, @role)
    `);

  console.log(`[seed] created secretary user "${SECRETARY.username}" with id ${id}`);
  await closePool();
}

main().catch(async (err) => {
  console.error('[seed] failed:', err.message);
  await closePool().catch(() => {});
  process.exit(1);
});
