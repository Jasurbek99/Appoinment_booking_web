// Step 8 stub. Step 14 replaces with real socket.io-client wiring + room subs.
// Components subscribe via useAppointmentEvents — until Step 14 lands the
// callbacks just never fire.

import { createContext, useContext } from 'react';

const SocketContext = createContext({ socket: null });

export function SocketProvider({ children }) {
  return <SocketContext.Provider value={{ socket: null }}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}

// No-op until Step 14.
export function useAppointmentEvents() {}
