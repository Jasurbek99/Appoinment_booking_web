// Shared helpers for integration tests: create / clean up DB users,
// log in via supertest agent, etc.

import bcrypt from 'bcrypt';
import sql from 'mssql';
import { getPool } from '../../src/db/pool.js';
import { config } from '../../src/config.js';

export async function createTestUser({
  id,
  username,
  display_name = `Test ${username}`,
  role,
  password = 'test-pwd-1234',
}) {
  const pool = await getPool();
  const hash = await bcrypt.hash(password, config.bcryptRounds);
  await deleteTestUser(id);
  await pool
    .request()
    .input('id', sql.NVarChar(50), id)
    .input('display_name', sql.NVarChar(200), display_name)
    .input('username', sql.NVarChar(50), username)
    .input('password_hash', sql.NVarChar(200), hash)
    .input('role', sql.NVarChar(20), role).query(`
      INSERT INTO users (id, display_name, username, password_hash, role)
      VALUES (@id, @display_name, @username, @password_hash, @role)
    `);
  return { id, username, display_name, role, password };
}

export async function deleteTestUser(idOrUsername) {
  const pool = await getPool();
  await pool
    .request()
    .input('v', sql.NVarChar(50), idOrUsername)
    .query('DELETE FROM users WHERE id = @v OR username = @v');
}

export async function loginAgent(agent, user) {
  const r = await agent
    .post('/api/auth/login')
    .send({ username: user.username, password: user.password });
  if (r.status !== 200) {
    throw new Error(`loginAgent failed for ${user.username}: ${r.status} ${JSON.stringify(r.body)}`);
  }
  return agent;
}
