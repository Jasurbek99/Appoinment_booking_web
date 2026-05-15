import { defineConfig, loadEnv, createLogger } from 'vite';
import react from '@vitejs/plugin-react';

// Vite re-logs every proxy error its built-in handler sees. In dev this
// floods the terminal during normal client disconnects (tab close, HMR
// reload) and during the brief windows when the backend restarts. Drop
// the known-benign codes but keep one rate-limited line for ECONNREFUSED
// so a genuinely-down backend is still visible.
const QUIET_CODES = ['ECONNABORTED', 'ECONNRESET', 'EPIPE'];
const QUIET_RE = new RegExp(`(http|ws) proxy.*(${QUIET_CODES.join('|')})`, 's');
const REFUSED_RE = /proxy.*ECONNREFUSED/s;
let lastRefusedLogAt = 0;

const logger = createLogger();
const baseError = logger.error.bind(logger);
logger.error = (msg, opts) => {
  if (typeof msg === 'string') {
    if (QUIET_RE.test(msg)) return;
    if (REFUSED_RE.test(msg)) {
      const now = Date.now();
      if (now - lastRefusedLogAt < 5000) return;
      lastRefusedLogAt = now;
      baseError('[proxy] backend unreachable (ECONNREFUSED) — is it running?', opts);
      return;
    }
  }
  baseError(msg, opts);
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL || 'http://localhost:3000';
  return {
    plugins: [react()],
    customLogger: logger,
    server: {
      port: 5173,
      proxy: {
        '/api': { target: apiUrl, changeOrigin: true },
        '/socket.io': { target: apiUrl, ws: true, changeOrigin: true },
      },
    },
  };
});
