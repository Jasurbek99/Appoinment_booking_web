import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import sql from 'mssql';
import { createApp } from '../../src/server.js';
import { getPool, closePool } from '../../src/db/pool.js';
import { createTestUser, loginAgent } from '../helpers/testUsers.js';

const SECRETARY = {
  id: 'u_causes_sec',
  username: 'sec_causes_test',
  role: 'secretary',
  password: 'test-pwd-1234',
};

let app;

beforeAll(async () => {
  await createTestUser(SECRETARY);
  app = createApp();
});

afterAll(async () => {
  const pool = await getPool();
  await pool.request().query(`DELETE FROM appointments WHERE cause_id LIKE 'ctest_%'`);
  await pool.request().query(`DELETE FROM causes WHERE id LIKE 'ctest_%'`);
  await pool.request().query(`DELETE FROM users WHERE id = '${SECRETARY.id}'`);
  await closePool();
});

beforeEach(async () => {
  const pool = await getPool();
  await pool.request().query(`DELETE FROM appointments WHERE cause_id LIKE 'ctest_%'`);
  await pool.request().query(`DELETE FROM causes WHERE id LIKE 'ctest_%'`);
});

describe('Causes', () => {
  it('GET is public (no auth) and returns the system causes', async () => {
    const r = await request(app).get('/api/causes');
    expect(r.status).toBe(200);
    const ids = r.body.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['work', 'personal', 'other']));
    expect(r.body.find((c) => c.id === 'work').isSystem).toBe(true);
  });

  it('staff can create, update, delete a non-system cause', async () => {
    const agent = await loginAgent(request.agent(app), SECRETARY);
    const created = await agent
      .post('/api/causes')
      .send({ id: 'ctest_meeting', label_ru: 'Встреча', label_tk: 'Duşuşyk' });
    expect(created.status).toBe(201);
    expect(created.body.isSystem).toBe(false);

    const updated = await agent
      .patch('/api/causes/ctest_meeting')
      .send({ label_ru: 'Встреча X' });
    expect(updated.status).toBe(200);
    expect(updated.body.label_ru).toBe('Встреча X');

    const del = await agent.delete('/api/causes/ctest_meeting');
    expect(del.status).toBe(200);
  });

  it('cannot delete a system cause (409 system_cause)', async () => {
    const agent = await loginAgent(request.agent(app), SECRETARY);
    const r = await agent.delete('/api/causes/work');
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('system_cause');
  });

  it('cannot delete a referenced cause (409 cause_referenced)', async () => {
    const agent = await loginAgent(request.agent(app), SECRETARY);
    await agent
      .post('/api/causes')
      .send({ id: 'ctest_used', label_ru: 'X', label_tk: 'X' });

    const pool = await getPool();
    await pool.request().query(`
      INSERT INTO appointments
        (visitor_type, visitor_first_name, visitor_last_name, boss_id, cause_id, urgent, visit_date, status)
      VALUES ('guest', N'A', N'B', 'boss1', 'ctest_used', 0, CAST(GETDATE() AS DATE), 'pending')
    `);

    const r = await agent.delete('/api/causes/ctest_used');
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('cause_referenced');
  });

  it('non-staff (boss) cannot create', async () => {
    const boss = await createTestUser({
      id: 'u_causes_b1',
      username: 'b_causes_test',
      role: 'boss1',
    });
    const agent = await loginAgent(request.agent(app), boss);
    const r = await agent
      .post('/api/causes')
      .send({ id: 'ctest_no', label_ru: 'A', label_tk: 'A' });
    expect(r.status).toBe(403);

    const pool = await getPool();
    await pool.request().input('v', sql.NVarChar(50), boss.id).query('DELETE FROM users WHERE id = @v');
  });
});
