import sql from 'mssql';
import { config } from '../config.js';

const poolConfig = {
  server: config.employeeDb.server,
  port: config.employeeDb.port,
  database: config.employeeDb.database,
  user: config.employeeDb.user,
  password: config.employeeDb.password,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
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
