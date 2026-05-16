// Hook used by dashboards to receive realtime updates and patch the
// TanStack Query cache in place — no refetch. Also funnels notable events
// into the NotificationCenter (badge + sound + toast + browser notif).

import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppointmentEvents } from '../contexts/SocketContext.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNotificationCenter } from '../contexts/NotificationCenter.jsx';

const KEY = 'appointments';
const ALWAYS = () => true;

export function useLiveAppointments({ todayMatcher = ALWAYS } = {}) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const { user } = useAuth();
  const { notify } = useNotificationCenter();

  const handlers = useMemo(() => {
    // Map each event to (title key, toast kind). Urgent creations get the
    // special "urgent" title; ordinary creations use the generic newRequest.
    const make = (action, titleKey, kind = 'info') => (dto) => {
      applyToCache(qc, dto, todayMatcher);
      if (isOwnAction(dto, user)) return;
      notify({
        id: `appt:${dto.id}:${action}`,
        kind,
        title: t(titleKey),
        message: visitorLabel(dto),
      });
    };
    return {
      created: (dto) => {
        applyToCache(qc, dto, todayMatcher);
        if (isOwnAction(dto, user)) return;
        notify({
          id: `appt:${dto.id}:created`,
          kind: dto.urgent ? 'error' : 'info',
          title: t(dto.urgent ? 'newUrgentRequest' : 'notif_newRequest'),
          message: visitorLabel(dto),
        });
      },
      approved: make('approved', 'notif_approved', 'success'),
      rejected: make('rejected', 'notif_rejected', 'error'),
      invited: make('invited', 'notif_invited'),
      completed: make('completed', 'notif_completed', 'success'),
      rescheduled: make('rescheduled', 'notif_rescheduled'),
      // Soft-delete arrives as a minimal { id, bossId } payload; drop the
      // matching row from every cached list. Silent — no notification,
      // since this is undo of a secretarial mistake, not an event anyone
      // else needs to be alerted about.
      deleted: ({ id }) => removeFromCache(qc, id),
    };
  }, [qc, todayMatcher, notify, t, user]);

  useAppointmentEvents(handlers);
}

function removeFromCache(qc, id) {
  for (const mode of ['today', 'future']) {
    qc.setQueryData([KEY, mode], (cur) => {
      if (!Array.isArray(cur)) return cur;
      const idx = cur.findIndex((a) => a.id === id);
      if (idx === -1) return cur;
      const next = cur.slice();
      next.splice(idx, 1);
      return next;
    });
  }
}

function applyToCache(qc, dto, matcher) {
  for (const mode of ['today', 'future']) {
    qc.setQueryData([KEY, mode], (cur) => {
      if (!Array.isArray(cur)) return cur;
      const idx = cur.findIndex((a) => a.id === dto.id);
      if (idx === -1) {
        // New row — only add to the matching list.
        if (mode === 'today' && matcher(dto)) return [dto, ...cur];
        return cur;
      }
      const next = cur.slice();
      next[idx] = dto;
      return next;
    });
  }
}

function visitorLabel(dto) {
  if (dto.employee) return `${dto.employee.firstName} ${dto.employee.lastName}`;
  if (dto.visitor) return `${dto.visitor.firstName} ${dto.visitor.lastName}`;
  return '';
}

// Suppress notifications for events the current user triggered themselves —
// the last history entry is the actor of the current action.
function isOwnAction(dto, user) {
  if (!user) return false;
  const last = dto?.history?.[dto.history.length - 1];
  return !!last && last.user?.id === user.id;
}
