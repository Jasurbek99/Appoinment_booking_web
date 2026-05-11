import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import sql from 'mssql';
import { createApp } from '../../src/server.js';
import { getPool, closePool } from '../../src/db/pool.js';
import { createTestUser, loginAgent, withHistoryUnlocked } from '../helpers/testUsers.js';

const SECRETARY = {
  id: 'u_aread_sec',
  username: 'sec_aread_test',
  role: 'secretary',
  password: 'test-pwd-1234',
};
const BOSS1 = { id: 'u_aread_b1', username: 'b1_aread_test', role: 'boss1', password: 'test-pwd-1234' };
const BOSS2 = { id: 'u_aread_b2', username: 'b2_aread_test', role: 'boss2', password: 'test-pwd-1234' };

let app;

async function clearAppointments(_pool) {
  await withHistoryUnlocked(async (pool) => {
    await pool.request().query(`
      DELETE FROM appointment_history
      WHERE appointment_id IN (SELECT id FROM appointments WHERE visitor_last_name LIKE 'AR_%');
    `);
  });
  const pool = await getPool();
  await pool.request().query(`DELETE FROM appointments WHERE visitor_last_name LIKE 'AR_%'`);
}

async function insertAppt(pool, { offsetDays = 0, status = 'pending', bossId = 'boss1', urgent = 0, lastName }) {
  const r = await pool.request()
    .input('boss', sql.NVarChar(20), bossId)
    .input('status', sql.NVarChar(20), status)
    .input('urgent', sql.Bit, urgent)
    .input('lastName', sql.NVarChar(100), lastName)
    .input('offset', sql.Int, offsetDays)
    .query(`
      INSERT INTO appointments
        (visitor_type, visitor_first_name, visitor_last_name, boss_id, cause_id, urgent, visit_date, status)
      OUTPUT INSERTED.id
      VALUES ('guest', N'Test', @lastName, @boss, 'work', @urgent,
        DATEADD(day, @offset, CAST(GETDATE() AS DATE)), @status)
    `);
  return r.recordset[0].id;
}

beforeAll(async () => {
  await createTestUser(SECRETARY);
  await createTestUser(BOSS1);
  await createTestUser(BOSS2);
  app = createApp();
});

afterAll(async () => {
  await clearAppointments();
  const pool = await getPool();
  await pool.request().query(
    `DELETE FROM users WHERE id IN ('${SECRETARY.id}','${BOSS1.id}','${BOSS2.id}')`,
  );
  await closePool();
});

beforeEach(async () => {
  await clearAppointments();
});

describe('GET /api/appointments (carryover and scoping)', () => {
  it('today mode includes carryover (yesterday approved) but not yesterday-completed', async () => {
    const pool = await getPool();
    await insertAppt(pool, { offsetDays: 0, status: 'pending', lastName: 'AR_today_pending' });
    const carryId = await insertAppt(pool, { offsetDays: -1, status: 'approved', lastName: 'AR_carry' });
    await insertAppt(pool, { offsetDays: -1, status: 'completed', lastName: 'AR_yest_done' });
    await insertAppt(pool, { offsetDays: 1, status: 'approved', lastName: 'AR_tomorrow' });

    const agent = await loginAgent(request.agent(app), SECRETARY);
    const r = await agent.get('/api/appointments');

    expect(r.status).toBe(200);
    const lastNames = r.body.map((a) => a.visitor?.lastName);
    expect(lastNames).toEqual(expect.arrayContaining(['AR_today_pending', 'AR_carry']));
    expect(lastNames).not.toContain('AR_yest_done');
    expect(lastNames).not.toContain('AR_tomorrow');

    expect(r.body.find((a) => a.id === carryId).status).toBe('approved');
  });

  it('boss role auto-scopes to own boss_id, ignoring forged ?boss_id', async () => {
    const pool = await getPool();
    await insertAppt(pool, { bossId: 'boss1', lastName: 'AR_b1' });
    await insertAppt(pool, { bossId: 'boss2', lastName: 'AR_b2' });

    const agent = await loginAgent(request.agent(app), BOSS1);
    const r = await agent.get('/api/appointments?boss_id=boss2');
    expect(r.status).toBe(200);
    const names = r.body.map((a) => a.visitor.lastName);
    expect(names).toContain('AR_b1');
    expect(names).not.toContain('AR_b2');
  });

  it('urgent-pending sorts before non-urgent', async () => {
    const pool = await getPool();
    // older non-urgent
    await insertAppt(pool, { lastName: 'AR_first' });
    // newer urgent — should leapfrog
    await insertAppt(pool, { urgent: 1, lastName: 'AR_urgent' });

    const agent = await loginAgent(request.agent(app), SECRETARY);
    const r = await agent.get('/api/appointments');
    const ours = r.body.filter((a) => /^AR_/.test(a.visitor.lastName));
    expect(ours[0].visitor.lastName).toBe('AR_urgent');
  });

  it('future mode returns only > today', async () => {
    const pool = await getPool();
    await insertAppt(pool, { offsetDays: 0, lastName: 'AR_today' });
    await insertAppt(pool, { offsetDays: 1, lastName: 'AR_tomorrow' });
    await insertAppt(pool, { offsetDays: 5, lastName: 'AR_next_week' });

    const agent = await loginAgent(request.agent(app), SECRETARY);
    const r = await agent.get('/api/appointments?future=true');
    const names = r.body.map((a) => a.visitor.lastName);
    expect(names).toContain('AR_tomorrow');
    expect(names).toContain('AR_next_week');
    expect(names).not.toContain('AR_today');
  });
});
