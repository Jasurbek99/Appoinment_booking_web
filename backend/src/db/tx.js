// Single transaction helper. Callback receives a sql.Transaction.
// Rolls back on throw, commits if the callback resolves.

import sql from 'mssql';
import { getPool } from './pool.js';

export async function withTransaction(fn) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (err) {
    try {
      await tx.rollback();
    } catch {
      // already rolled back / aborted — nothing to do
    }
    throw err;
  }
}
