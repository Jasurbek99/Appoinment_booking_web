import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import sql from 'mssql';
import { createApp } from '../../src/server.js';
import { getPool, closePool } from '../../src/db/pool.js';
import { createTestUser, deleteTestUser, loginAgent } from '../helpers/testUsers.js';

const SECRETARY = {
  id: 'u_users_sec',
  username: 'sec_users_test',
  role: 'secretary',
  password: 'test-pwd-1234',
};

let app;

beforeAll(async () => {
  await createTestUser(SECRETARY);
  app = createApp();
});

afterAll(async () => {
  // Best-effort cleanup of any leaked rows.
  const pool = await getPool();
  await pool.request().query(
    `DELETE FROM users WHERE username LIKE 'utest_%' OR id LIKE 'u_users_%'`,
  );
  await closePool();
});

beforeEach(async () => {
  const pool = await getPool();
  await pool.request().query(`DELETE FROM users WHERE username LIKE 'utest_%'`);
});

describe('Users CRUD', () => {
  it('lists active users', async () => {
    const agent = await loginAgent(request.agent(app), SECRETARY);
    const r = await agent.get('/api/users');
    expect(r.status).toBe(200);
    expect(r.body.find((u) => u.username === SECRETARY.username)).toBeTruthy();
  });

  it('creates a user that can immediately log in', async () => {
    const agent = await loginAgent(request.agent(app), SECRETARY);
    const created = await agent.post('/api/users').send({
      display_name: 'Created Person',
      username: 'utest_created',
      password: 'pw_abcd_1234',
      role: 'assistant1',
    });
    expect(created.status).toBe(201);
    expect(created.body.username).toBe('utest_created');

    const newAgent = request.agent(app);
    const login = await newAgent
      .post('/api/auth/login')
      .send({ username: 'utest_created', password: 'pw_abcd_1234' });
    expect(login.status).toBe(200);
    expect(login.body.role).toBe('assistant1');
  });

  it('returns 409 username_taken on duplicate username', async () => {
    const agent = await loginAgent(request.agent(app), SECRETARY);
    await agent.post('/api/users').send({
      display_name: 'A',
      username: 'utest_dup',
      password: 'pw_abcd_1234',
      role: 'assistant1',
    });
    const second = await agent.post('/api/users').send({
      display_name: 'B',
      username: 'utest_dup',
      password: 'pw_abcd_1234',
      role: 'assistant2',
    });
    expect(second.status).toBe(409);
  });

  it('omitting password on PATCH keeps existing password', async () => {
    const agent = await loginAgent(request.agent(app), SECRETARY);
    const u = (
      await agent.post('/api/users').send({
        display_name: 'Keep Pwd',
        username: 'utest_keep',
        password: 'pw_original_1234',
        role: 'assistant1',
      })
    ).body;

    await agent.patch(`/api/users/${u.id}`).send({ display_name: 'Renamed' });

    const newAgent = request.agent(app);
    const login = await newAgent
      .post('/api/auth/login')
      .send({ username: 'utest_keep', password: 'pw_original_1234' });
    expect(login.status).toBe(200);
  });

  it('soft-delete sets deleted_at and hides from list', async () => {
    const agent = await loginAgent(request.agent(app), SECRETARY);
    const u = (
      await agent.post('/api/users').send({
        display_name: 'Doomed',
        username: 'utest_doomed',
        password: 'pw_abcd_1234',
        role: 'assistant3',
      })
    ).body;

    const del = await agent.delete(`/api/users/${u.id}`);
    expect(del.status).toBe(200);

    const listed = await agent.get('/api/users');
    expect(listed.body.find((x) => x.id === u.id)).toBeUndefined();

    const pool = await getPool();
    const r = await pool
      .request()
      .input('id', sql.NVarChar(50), u.id)
      .query('SELECT deleted_at FROM users WHERE id = @id');
    expect(r.recordset[0].deleted_at).toBeTruthy();
  });

  it('cannot delete self (forbidden_self)', async () => {
    const agent = await loginAgent(request.agent(app), SECRETARY);
    const r = await agent.delete(`/api/users/${SECRETARY.id}`);
    expect(r.status).toBe(403);
    expect(r.body.error).toBe('forbidden_self');
  });

  it('cannot change own role', async () => {
    const agent = await loginAgent(request.agent(app), SECRETARY);
    const r = await agent
      .patch(`/api/users/${SECRETARY.id}`)
      .send({ role: 'assistant1' });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe('forbidden_self');
  });
});

// silence unused imports warning
deleteTestUser;
