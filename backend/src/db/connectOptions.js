// Build the mssql connection options from our config shape.
//
// Handles named instances: when DB_SERVER is "host\INSTANCE", tedious needs
// the instance name in `options.instanceName` (not in `server`), and `port`
// must be omitted so SQL Server Browser (UDP 1434) can resolve the dynamic
// port the instance listens on. Passing both port and instanceName makes
// tedious ignore the instance and silently try the wrong port.
export function buildMssqlConnectionOptions(db) {
  const raw = db.server ?? '';
  const sep = raw.indexOf('\\');
  const hasInstance = sep !== -1;
  const server = hasInstance ? raw.slice(0, sep) : raw;
  const instanceName = hasInstance ? raw.slice(sep + 1) : undefined;

  return {
    server,
    database: db.database,
    user: db.user,
    password: db.password,
    // With a named instance, leave port undefined so SQL Browser resolves
    // the dynamic port. With a default instance, use the configured port.
    ...(hasInstance ? {} : { port: db.port }),
    options: {
      encrypt: false,
      trustServerCertificate: true,
      enableArithAbort: true,
      ...(hasInstance ? { instanceName } : {}),
    },
  };
}
