// Verifies the NotificationCenter behavior most likely to regress:
// badge counter, DND persisted to localStorage, DND suppresses sound but
// still records the event, and clear actions zero out state.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { render } from '@testing-library/react';
import { NotificationCenterProvider, useNotificationCenter } from './NotificationCenter.jsx';

// Mock AuthContext so the provider can read a user.
let currentUser = { id: 42, role: 'boss1', displayName: 'B1' };
vi.mock('./AuthContext.jsx', () => ({
  useAuth: () => ({ user: currentUser }),
}));

// Mock ToastProvider — capture the toasts that get pushed.
const pushSpy = vi.fn();
vi.mock('./ToastProvider.jsx', () => ({
  useToast: () => ({ push: pushSpy }),
}));

function Harness({ captureRef }) {
  const ctx = useNotificationCenter();
  captureRef.current = ctx;
  return null;
}

function renderHarness() {
  const ref = { current: null };
  const utils = render(
    <NotificationCenterProvider>
      <Harness captureRef={ref} />
    </NotificationCenterProvider>,
  );
  return { ...utils, ref };
}

describe('NotificationCenter', () => {
  beforeEach(() => {
    pushSpy.mockReset();
    localStorage.clear();
    currentUser = { id: 42, role: 'boss1', displayName: 'B1' };
    // Stub AudioContext — code path is best-effort, but we don't want test noise.
    // (jsdom doesn't ship AudioContext.)
    // eslint-disable-next-line no-undef
    window.AudioContext = vi.fn().mockImplementation(() => ({
      state: 'running',
      currentTime: 0,
      createOscillator: () => ({
        type: '',
        frequency: { setValueAtTime: vi.fn() },
        connect: () => ({ connect: vi.fn() }),
        start: vi.fn(),
        stop: vi.fn(),
      }),
      createGain: () => ({
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: () => ({ connect: vi.fn() }),
      }),
      destination: {},
      resume: vi.fn().mockResolvedValue(undefined),
    }));
  });

  afterEach(() => {
    delete window.AudioContext;
  });

  it('starts empty and pushes a toast on notify', () => {
    const { ref } = renderHarness();
    expect(ref.current.unread).toBe(0);
    expect(ref.current.items).toHaveLength(0);

    act(() => {
      ref.current.notify({ title: 'Hello', message: 'World' });
    });

    expect(ref.current.unread).toBe(1);
    expect(ref.current.items).toHaveLength(1);
    expect(ref.current.items[0]).toMatchObject({ title: 'Hello', message: 'World' });
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it('DND persists per-user in localStorage', () => {
    const { ref } = renderHarness();
    expect(ref.current.dnd).toBe(false);

    act(() => ref.current.setDnd(true));
    expect(ref.current.dnd).toBe(true);
    expect(localStorage.getItem('dnd:42')).toBe('1');

    act(() => ref.current.setDnd(false));
    expect(ref.current.dnd).toBe(false);
    expect(localStorage.getItem('dnd:42')).toBeNull();
  });

  it('DND state is read back on mount', () => {
    localStorage.setItem('dnd:42', '1');
    const { ref } = renderHarness();
    expect(ref.current.dnd).toBe(true);
  });

  it('DND still records the event and pushes the toast', () => {
    const { ref } = renderHarness();
    act(() => ref.current.setDnd(true));

    act(() => {
      ref.current.notify({ title: 'Quiet' });
    });

    expect(ref.current.unread).toBe(1);
    expect(ref.current.items).toHaveLength(1);
    expect(pushSpy).toHaveBeenCalledTimes(1); // toast still goes through
  });

  it('clearUnread zeroes badge but keeps items; clearAll wipes both', () => {
    const { ref } = renderHarness();
    act(() => {
      ref.current.notify({ title: 'A' });
      ref.current.notify({ title: 'B' });
    });
    expect(ref.current.unread).toBe(2);
    expect(ref.current.items).toHaveLength(2);

    act(() => ref.current.clearUnread());
    expect(ref.current.unread).toBe(0);
    expect(ref.current.items).toHaveLength(2);

    act(() => ref.current.clearAll());
    expect(ref.current.unread).toBe(0);
    expect(ref.current.items).toHaveLength(0);
  });

  it('caps the items list to a finite length', () => {
    const { ref } = renderHarness();
    act(() => {
      for (let i = 0; i < 25; i++) ref.current.notify({ title: `n${i}` });
    });
    // MAX_ITEMS is 20.
    expect(ref.current.items).toHaveLength(20);
    expect(ref.current.items[0].title).toBe('n24');
  });
});
