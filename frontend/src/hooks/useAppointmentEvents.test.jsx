// Verifies the live-events hook suppresses notifications for actions the
// current user just performed (no self-toasts on your own clicks), and
// notifies on events triggered by someone else.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLiveAppointments } from './useAppointmentEvents.js';

// Capture the handlers registered with the socket hook so the test can
// invoke them directly.
let registeredHandlers = null;
vi.mock('../contexts/SocketContext.jsx', () => ({
  useAppointmentEvents: (h) => {
    registeredHandlers = h;
  },
}));

const notifySpy = vi.fn();
vi.mock('../contexts/NotificationCenter.jsx', () => ({
  useNotificationCenter: () => ({ notify: notifySpy }),
}));

let currentUser = { id: 7, role: 'secretary' };
vi.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: () => ({ user: currentUser }),
}));

vi.mock('../contexts/I18nProvider.jsx', () => ({
  useI18n: () => ({ t: (k) => k }),
}));

function Harness() {
  useLiveAppointments();
  return null;
}

function mount() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <Harness />
    </QueryClientProvider>,
  );
}

function dtoWithActor(actorUserId, extra = {}) {
  return {
    id: 100,
    bossId: 'boss1',
    status: 'invited',
    urgent: false,
    visitor: { firstName: 'Иван', lastName: 'Петров' },
    history: [
      { action: 'create', user: { id: 99 }, at: '2026-05-14T10:00:00Z' },
      { action: 'approve', user: { id: 1 }, at: '2026-05-14T10:01:00Z' },
      { action: 'invite', user: { id: actorUserId }, at: '2026-05-14T10:02:00Z' },
    ],
    ...extra,
  };
}

describe('useLiveAppointments', () => {
  beforeEach(() => {
    notifySpy.mockReset();
    registeredHandlers = null;
    currentUser = { id: 7, role: 'secretary' };
  });

  it('notifies on invited when the current user is NOT the actor', () => {
    mount();
    registeredHandlers.invited(dtoWithActor(/* actor */ 99));
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(notifySpy.mock.calls[0][0]).toMatchObject({
      title: 'notif_invited',
      message: 'Иван Петров',
    });
  });

  it('suppresses invited when the current user IS the actor', () => {
    currentUser = { id: 99, role: 'boss1' };
    mount();
    registeredHandlers.invited(dtoWithActor(/* actor */ 99));
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('uses the urgent title for urgent creations and the plain title otherwise', () => {
    mount();
    registeredHandlers.created(dtoWithActor(99, { urgent: false }));
    expect(notifySpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'notif_newRequest', kind: 'info' }),
    );

    registeredHandlers.created(dtoWithActor(99, { urgent: true }));
    expect(notifySpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'newUrgentRequest', kind: 'error' }),
    );
    expect(notifySpy).toHaveBeenCalledTimes(2);
  });

  it('notifies on every state change when someone else is the actor', () => {
    mount();
    registeredHandlers.approved(dtoWithActor(99));
    registeredHandlers.rejected(dtoWithActor(99));
    registeredHandlers.completed(dtoWithActor(99));
    registeredHandlers.rescheduled(dtoWithActor(99));
    expect(notifySpy).toHaveBeenCalledTimes(4);
    const titles = notifySpy.mock.calls.map((c) => c[0].title);
    expect(titles).toEqual([
      'notif_approved',
      'notif_rejected',
      'notif_completed',
      'notif_rescheduled',
    ]);
  });

  it('suppresses all state changes when the current user IS the actor', () => {
    currentUser = { id: 99, role: 'boss1' };
    mount();
    registeredHandlers.created(dtoWithActor(99));
    registeredHandlers.approved(dtoWithActor(99));
    registeredHandlers.rejected(dtoWithActor(99));
    registeredHandlers.completed(dtoWithActor(99));
    registeredHandlers.rescheduled(dtoWithActor(99));
    expect(notifySpy).not.toHaveBeenCalled();
  });
});
