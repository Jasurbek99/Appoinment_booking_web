// Hook used by dashboards to receive realtime updates and patch the
// TanStack Query cache in place — no refetch.

import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppointmentEvents } from '../contexts/SocketContext.jsx';
import { useToast } from '../contexts/ToastProvider.jsx';
import { useI18n } from '../contexts/I18nProvider.jsx';

const KEY = 'appointments';
const ALWAYS = () => true;

export function useLiveAppointments({ todayMatcher = ALWAYS } = {}) {
  const qc = useQueryClient();
  const { push } = useToast();
  const { t } = useI18n();

  const handlers = useMemo(
    () => ({
      created: (dto) => {
        applyToCache(qc, dto, todayMatcher);
        if (dto.urgent) push({ kind: 'info', title: t('newUrgentRequest') });
      },
      approved: (dto) => applyToCache(qc, dto, todayMatcher),
      rejected: (dto) => applyToCache(qc, dto, todayMatcher),
      invited: (dto) => {
        applyToCache(qc, dto, todayMatcher);
        push({ kind: 'info', title: t('notif_invited'), message: visitorLabel(dto) });
        maybeFireBrowserNotification(dto, t);
      },
      completed: (dto) => applyToCache(qc, dto, todayMatcher),
      rescheduled: (dto) => applyToCache(qc, dto, todayMatcher),
    }),
    [qc, todayMatcher, push, t],
  );

  useAppointmentEvents(handlers);
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

function maybeFireBrowserNotification(dto, t) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return;
  try {
    new Notification(t('notif_invited'), { body: visitorLabel(dto) });
  } catch {
    // ignore
  }
}
