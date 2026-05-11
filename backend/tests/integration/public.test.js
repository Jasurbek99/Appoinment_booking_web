import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import sql from 'mssql';
import { createApp } from '../../src/server.js';
import { getPool, closePool } from '../../src/db/pool.js';
import { createTestUser, loginAgent } from '../helpers/testUsers.js';

const SECRETARY = { id: 'u_pub_sec', username: 'sec_pub', role: 'secretary', password: 'test-pwd-1234' };

let app;

async function clear(pool) {
  await pool.request().query(`
    DELETE FROM appointment_history
    WHERE appointment_id IN (
      SELECT id FROM appointments WHERE visitor_last_name LIKE 'PB_%'
    );
  `);
  await pool.request().query(`DELETE FROM appointments WHERE visitor_last_name LIKE 'PB_%'`);
}

beforeAll(async () => {
  await createTestUser(SECRETARY);
  app = createApp();
});

afterAll(async () => {
  const pool = await getPool();
  await clear(pool);
  await pool.request().query(`DELETE FROM users WHERE id = '${SECRETARY.id}'`);
  await closePool();
});

beforeEach(async () => {
  await clear(await getPool());
});

describe('GET /api/public/appointments', () => {
  it('returns matching appointments without internal user IDs', async () => {
    const sec = await loginAgent(request.agent(app), SECRETARY);
    await sec.post('/api/appointments').send({
      visitorType: 'guest',
      visitor: { firstName: 'Public', lastName: 'PB_target' },
      bossId: 'boss1',
      causeId: 'work',
      urgent: false,
      date: new Date().toISOString().slice(0, 10),
    });

    const r = await request(app).get('/api/public/appointments').query({ lastname: 'PB_target' });
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);

    const json = JSON.stringify(r.body);
    // No internal user IDs (they all start with u_) should appear in the public payload.
    expect(json).not.toMatch(/"u_[a-z0-9]/i);
    // The history actor must carry displayName + role only — never id.
    for (const item of r.body) {
      for (const h of item.history) {
        expect(h).not.toHaveProperty('user');
        expect(h).toHaveProperty('actor');
        expect(h.actor).not.toHaveProperty('id');
      }
    }
  });

  it('non-matching lastname returns []', async () => {
    const r = await request(app).get('/api/public/appointments').query({ lastname: 'PB_nope' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
  });

  it('rejects empty / missing lastname (400)', async () => {
    const r = await request(app).get('/api/public/appointments');
    expect(r.status).toBe(400);
  });

  it('SQL injection attempt is parameterized away', async () => {
    const r = await request(app)
      .get('/api/public/appointments')
      .query({ lastname: "'; DROP TABLE users; --" });
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
    // Verify users table still exists
    const pool = await getPool();
    const ok = await pool.request().query('SELECT COUNT(*) AS c FROM users');
    expect(ok.recordset[0].c).toBeGreaterThan(0);
  });
});

// silence unused import if linter ever complains
sql;
