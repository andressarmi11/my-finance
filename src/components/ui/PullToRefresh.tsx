import { IconRefresh } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { haptic } from '@/lib/haptic';
import { isStandalone } from '@/lib/platform';

/** How far (after resistance) the finger has to drag before releasing reloads. */
const THRESHOLD = 70;

/**
 * Reloads the app. A full reload on purpose, not a refetch: it's what
 * closing and reopening did — the only way there was to see what the
 * Shortcuts left in the inbox — and on start-up the app already runs a
 * full sync and re-reads the inbox. Local changes are safe: they live in
 * IndexedDB and that start-up sync uploads them.
 */
export function refreshApp(): void {
  haptic('medium');
  window.location.reload();
}

/**
 * Pull down from the top to refresh, like any iOS app.
 *
 * Only in the home-screen app: Safari already has its own, and both at
 * once would reload twice. Drags that start inside a sheet or dialog are
 * ignored — those scroll on their own, and swiping one down must not
 * reload the page under it.
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);

  useEffect(() => {
    if (!isStandalone()) return;
    let startY: number | null = null;
    let distance = 0;

    function onStart(e: TouchEvent) {
      const insideSheet = e.target instanceof Element && e.target.closest('[role="dialog"]');
      startY = window.scrollY <= 0 && e.touches.length === 1 && !insideSheet ? e.touches[0]!.clientY : null;
      distance = 0;
    }
    function onMove(e: TouchEvent) {
      if (startY === null) return;
      if (window.scrollY > 0) {
        startY = null;
        setPull(0);
        return;
      }
      // Half the finger's travel: the resistance that makes it feel pulled.
      distance = Math.max(0, e.touches[0]!.clientY - startY) / 2;
      setPull(Math.min(distance, THRESHOLD * 1.4));
    }
    function onEnd() {
      if (startY !== null && distance >= THRESHOLD) refreshApp();
      startY = null;
      distance = 0;
      setPull(0);
    }

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  if (pull <= 0) return null;
  const ready = pull >= THRESHOLD;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 'calc(var(--safe-top) + 8px)',
        left: '50%',
        zIndex: 60,
        width: 40,
        height: 40,
        borderRadius: 20,
        display: 'grid',
        placeItems: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--line-strong)',
        boxShadow: 'var(--shadow-2)',
        color: ready ? 'var(--q10)' : 'var(--text-muted)',
        transform: `translate(-50%, ${pull}px) rotate(${pull * 4}deg)`,
        opacity: Math.min(1, pull / THRESHOLD),
      }}
    >
      <IconRefresh size={20} stroke={2} />
    </div>
  );
}
