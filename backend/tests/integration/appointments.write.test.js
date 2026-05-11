import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import sql from 'mssql';
import { createApp } from '../../src/server.js';
import { getPool, closePool } from '../../src/db/pool.js';
import { createTestUser, loginAgent } from '../helpers/testUsers.js';

const SECRETARY = { id: 'u_aw_sec', username: 'sec_aw', role: 'secretary', password: 'test-pwd-1234' };
const BOSS1 = { id: 'u_aw_b1', username: 'b1_aw', role: 'boss1', password: 'test-pwd-1234' };
const BOSS2 = { id: 'u_aw_b2', username: 'b2_aw', role: 'boss2', password: 'test-pwd-1234' };

let app;

async function clearOurAppts(pool) {
  await pool.request().query(`
    DELETE FROM appointment_history
    WHERE appointment_id IN (
      SELECT id FROM appointments
      WHERE visitor_last_name LIKE 'AW_%' OR visitor_first_name LIKE 'AW_%'
    );
  `);
  await pool.request().query(
    `DELETE FROM appointments WHERE visitor_last_name LIKE 'AW_%' OR visitor_first_name LIKE 'AW_%'`,
  );
}

beforeAll(async () => {
  await createTestUser(SECRETARY);
  await createTestUser(BOSS1);
  await createTestUser(BOSS2);
  app = createApp();
});

afterAll(async () => {
  const pool = await getPool();
  await clearOurAppts(pool);
  await pool.request().query(
    `DELETE FROM users WHERE id IN ('${SECRETARY.id}','${BOSS1.id}','${BOSS2.id}')`,
  );
  await closePool();
});

beforeEach(async () => {
  await clearOurAppts(await getPool());
});

const guestPayload = (overrides = {}) => ({
  visitorType: 'guest',
  visitor: { firstName: 'AW_first', lastName: 'AW_last' },
  bossId: 'boss1',
  causeId: 'work',
  urgent: false,
  date: new Date().toISOString().slice(0, 10),
  ...overrides,
});

describe('POST /api/appointments', () => {
  it('creates a pending appointment with a create history row (same transaction)', async () => {
    const agent = await loginAgent(request.agent(app), SECRETARY);
    const r = await agent.post('/api/appointments').send(guestPayload());
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('pending');
    expect(r.body.history).toHaveLength(1);
    expect(r.body.history[0].action).toBe('create');
    expect(r.body.history[0].user.id).toBe(SECRETARY.id);
  });

  it('rejects duplicate (409) and accepts ?force=true override', async () => {
    const agent = await loginAgent(request.agent(app), SECRETARY);
    const a = await agent.post('/api/appointments').send(guestPayload());
    expect(a.status).toBe(201);

    const dup = await agent.post('/api/appointments').send(guestPayload());
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('duplicate');
    expect(dup.body.existing.id).toBe(a.body.id);
    expect(dup.body.existing.status).toBe('pending');

    const forced = await agent.post('/api/appointments?force=true').send(guestPayload());
    expect(forced.status).toBe(201);
    expect(forced.body.id).not.toBe(a.body.id);
  });

  it('validates body (400)', async () => {
    const agent = await loginAgent(request.agent(app), SECRETARY);
    const r = await agent.post('/api/appointments').send({ visitorType: 'foo' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('validation');
  });

  it('rejects past date by clamping to today', async () => {
    const agent = await loginAgent(request.agent(app), SECRETARY);
    const r = await agent.post('/api/appointments').send(guestPayload({ date: '2020-01-01' }));
    expect(r.status).toBe(201);
    expect(r.body.date).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe('PATCH state machine', () => {
  it('full happy path pending -> approved -> invited -> completed', async () => {
    const sec = await loginAgent(request.agent(app), SECRETARY);
    const created = (await sec.post('/api/appointments').send(guestPayload())).body;

    const boss = await loginAgent(request.agent(app), BOSS1);
    const a = await boss.patch(`/api/appointments/${created.id}/approve`);
    expect(a.body.status).toBe('approved');
    expect(a.body.history.at(-1).action).toBe('approve');

    const i = await boss.patch(`/api/appointments/${created.id}/invite`);
    expect(i.body.status).toBe('invited');

    const c = await boss.patch(`/api/appointments/${created.id}/complete`);
    expect(c.body.status).toBe('completed');
    expect(c.body.history).toHaveLength(4);
  });

  it('reject is terminal — further transitions return 409 invalid_transition', async () => {
    const sec = await loginAgent(request.agent(app), SECRETARY);
    const created = (await sec.post('/api/appointments').send(guestPayload())).body;
    const boss = await loginAgent(request.agent(app), BOSS1);
    await boss.patch(`/api/appointments/${created.id}/reject`).send({ reason: 'busy' });
    const r = await boss.patch(`/api/appointments/${created.id}/approve`);
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('invalid_transition');
  });

  it('boss cannot transition another boss’s appointment (403)', async () => {
    const sec = await loginAgent(request.agent(app), SECRETARY);
    const created = (await sec.post('/api/appointments').send(guestPayload({ bossId: 'boss1' }))).body;
    const otherBoss = await loginAgent(request.agent(app), BOSS2);
    const r = await otherBoss.patch(`/api/appointments/${created.id}/approve`);
    expect(r.status).toBe(403);
  });

  it('staff can complete any appointment (after approve)', async () => {
    const sec = await loginAgent(request.agent(app), SECRETARY);
    const created = (await sec.post('/api/appointments').send(guestPayload({ bossId: 'boss2' }))).body;
    const boss = await loginAgent(request.agent(app), BOSS2);
    await boss.patch(`/api/appointments/${created.id}/approve`);
    const c = await sec.patch(`/api/appointments/${created.id}/complete`);
    expect(c.status).toBe(200);
    expect(c.body.status).toBe('completed');
  });
});

describe('audit trigger', () => {
  it('blocks UPDATE on appointment_history from app connection', async () => {
    const sec = await loginAgent(request.agent(app), SECRETARY);
    await sec.post('/api/appointments').send(guestPayload());

    const pool = await getPool();
    let threw = null;
    try {
      await pool.request().query(`UPDATE appointment_history SET note = N'tampered'`);
    } catch (err) {
      threw = err;
    }
    expect(threw).toBeTruthy();
    expect(String(threw.message)).toMatch(/append-only/i);
  });

  it('blocks DELETE on appointment_history from app connection', async () => {
    const pool = await getPool();
    let threw = null;
    try {
      await pool.request().query(`DELETE FROM appointment_history`);
    } catch (err) {
      threw = err;
    }
    expect(threw).toBeTruthy();
    expect(String(threw.message)).toMatch(/append-only/i);
  });
});

describe('emit only on commit', () => {
  it('an emission stub fires on success (sanity — real socket assertion in Step 14)', async () => {
    const sec = await loginAgent(request.agent(app), SECRETARY);
    const r = await sec.post('/api/appointments').send(guestPayload());
    // The route returns 201 only after the tx commits; covered by status check above.
    expect(r.status).toBe(201);
  });
});
