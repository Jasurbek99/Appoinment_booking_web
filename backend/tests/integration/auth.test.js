import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import sql from 'mssql';
import { createApp } from '../../src/server.js';
import { getPool, closePool } from '../../src/db/pool.js';
import { config } from '../../src/config.js';

const TEST_USER = {
  id: 'u_test_sec',
  username: 'sec_test',
  display_name: 'Test Secretary',
  role: 'secretary',
  password: 'test-pwd-1234',
};

async function ensureTestUser() {
  const pool = await getPool();
  const hash = await bcrypt.hash(TEST_USER.password, config.bcryptRounds);
  await pool
    .request()
    .input('id', sql.NVarChar(50), TEST_USER.id)
    .input('username', sql.NVarChar(50), TEST_USER.username)
    .query('DELETE FROM users WHERE id = @id OR username = @username');
  await pool
    .request()
    .input('id', sql.NVarChar(50), TEST_USER.id)
    .input('display_name', sql.NVarChar(200), TEST_USER.display_name)
    .input('username', sql.NVarChar(50), TEST_USER.username)
    .input('password_hash', sql.NVarChar(200), hash)
    .input('role', sql.NVarChar(20), TEST_USER.role).query(`
      INSERT INTO users (id, display_name, username, password_hash, role)
      VALUES (@id, @display_name, @username, @password_hash, @role)
    `);
}

let app;

beforeAll(async () => {
  await ensureTestUser();
  app = createApp();
});

afterAll(async () => {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.NVarChar(50), TEST_USER.id)
    .query('DELETE FROM users WHERE id = @id');
  await closePool();
});

describe('POST /api/auth/login', () => {
  it('issues a cookie on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USER.username, password: TEST_USER.password });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: TEST_USER.id,
      displayName: TEST_USER.display_name,
      role: TEST_USER.role,
    });
    expect(res.headers['set-cookie']?.[0] || '').toMatch(/token=.+; .*HttpOnly/i);
  });

  it('rejects invalid password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USER.username, password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });

  it('rejects missing body with 400 validation', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation');
  });
});

describe('GET /api/auth/me', () => {
  it('rejects without cookie (401)', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns current user with valid cookie', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ username: TEST_USER.username, password: TEST_USER.password });

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      id: TEST_USER.id,
      displayName: TEST_USER.display_name,
      role: TEST_USER.role,
    });
    expect(me.body.password_hash).toBeUndefined();
  });
});
