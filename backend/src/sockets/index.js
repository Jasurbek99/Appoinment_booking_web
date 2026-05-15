// Socket.io setup. Auth at the handshake via the JWT cookie (the same one
// the REST API uses), then place each socket into rooms by role.
//
// Workers (no auth) get a separate connection that doesn't pass the JWT;
// they self-subscribe to public:<lastname> rooms via the subscribe:lastname
// event after their lastname search.

import { Server } from 'socket.io';
import { parse as parseCookie } from 'cookie';
import { verifyToken } from '../services/auth.js';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const STAFF_ROLES = new Set(['secretary', 'assistant1', 'assistant2', 'assistant3']);
const BOSS_ROLES = new Set(['boss1', 'boss2', 'boss3']);

export function setupSockets(httpServer) {
  // Same-origin deployment (CORS_ORIGIN empty) → no CORS block needed.
  // Otherwise allow the configured origins with credentials so cookies flow.
  const serverOptions = config.corsOrigin.length > 0
    ? { cors: { origin: config.corsOrigin, credentials: true } }
    : {};
  const io = new Server(httpServer, serverOptions);

  io.use((socket, next) => {
    socket.data.user = null;
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie || '');
      const token = cookies.token;
      if (!token) return next(); // anonymous worker connection — allowed
      const payload = verifyToken(token);
      socket.data.user = {
        id: payload.sub,
        role: payload.role,
        displayName: payload.displayName,
      };
      next();
    } catch (err) {
      // Stale or invalid JWT: don't kill the connection — degrade to anonymous
      // so the client can still receive public:* events. The next API call
      // will return 401 and the AuthProvider will log the user out.
      if (process.env.NODE_ENV !== 'test') {
        logger.warn({ msg: err.message }, 'socket invalid token, treating as anonymous');
      }
      next();
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (user) {
      // Bosses join their own boss room; staff join the shared 'staff' room.
      if (BOSS_ROLES.has(user.role)) {
        socket.join(user.role);
      } else if (STAFF_ROLES.has(user.role)) {
        socket.join('staff');
      }
    }

    // Workers (and only they) opt into public:<lastname> updates.
    socket.on('subscribe:lastname', (lastname) => {
      if (typeof lastname !== 'string' || !lastname || lastname.length > 100) return;
      socket.join(`public:${lastname.toLowerCase()}`);
    });
    socket.on('unsubscribe:lastname', (lastname) => {
      if (typeof lastname !== 'string' || !lastname) return;
      socket.leave(`public:${lastname.toLowerCase()}`);
    });
  });

  return io;
}
