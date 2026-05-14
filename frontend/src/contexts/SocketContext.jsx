import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext({ socket: null });

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined; // undefined => same origin

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    // Establish a connection regardless of auth — the server allows anonymous
    // workers to connect (no JWT in cookie) for /status page subscriptions.
    // Default transport order (polling → upgrade) is used deliberately: the
    // Vite dev WS proxy is unreliable on Windows, so forcing 'websocket' first
    // causes silent connection failures. Long-polling always works through
    // the proxy and Socket.io upgrades to WS once the connection is alive.
    const s = io(SOCKET_URL, { withCredentials: true });
    ref.current = s;
    setSocket(s);

    if (import.meta.env.DEV) {
      s.on('connect', () => console.log('[socket] connected', s.id));
      s.on('disconnect', (reason) => console.log('[socket] disconnected', reason));
      s.on('connect_error', (err) => console.warn('[socket] connect_error', err.message));
      // Surface every appointment:* event arrival so the user can see whether
      // events are reaching the client at all.
      s.onAny((event, payload) => {
        if (typeof event === 'string' && event.startsWith('appointment:')) {
          console.log('[socket] event', event, payload?.id);
        }
      });
    }

    return () => {
      s.disconnect();
      ref.current = null;
      setSocket(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // re-connect when login/logout changes the cookie

  return <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}

// Subscribe to one or more appointment:* events. Handlers map: { 'created': fn, 'approved': fn, ... }
export function useAppointmentEvents(handlers) {
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket || !handlers) return;
    const entries = Object.entries(handlers);
    for (const [name, fn] of entries) socket.on(`appointment:${name}`, fn);
    return () => {
      for (const [name, fn] of entries) socket.off(`appointment:${name}`, fn);
    };
  }, [socket, handlers]);
}
