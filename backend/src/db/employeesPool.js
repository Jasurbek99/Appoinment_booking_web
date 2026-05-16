import sql from 'mssql';
import { config } from '../config.js';
import { buildMssqlConnectionOptions } from './connectOptions.js';

const poolConfig = {
  ...buildMssqlConnectionOptions(config.employeeDb),
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30_000,
  },
  requestTimeout: 3000,
  connectionTimeout: 3000,
};

let poolPromise = null;

export function getEmployeesPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(poolConfig)
      .connect()
      .catch((err) => {
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

export async function closeEmployeesPool() {
  if (!poolPromise) return;
  const pool = await poolPromise;
  poolPromise = null;
  await pool.close();
}
