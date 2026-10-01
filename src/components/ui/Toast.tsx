import { useEffect, useState } from 'react';
import { useBreakpoint } from '@/app/useBreakpoint';

/**
 * A one-line message for 4 s ("Plan eliminado…"), from anywhere: the screen
 * that shows it may be gone by the time it should read (deleting the plan
 * closes the plan screen). The inbox has its own, with Deshacer.
 */
type Listener = (message: string | null) => void;
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(message: string): void {
  clearTimeout(timer);
  for (const l of listeners) l(message);
  timer = setTimeout(() => { for (const l of listeners) l(null); }, 4_000);
}

export function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);
  const desktop = useBreakpoint() === 'desktop';
  useEffect(() => {
    listeners.add(setMessage);
    return () => { listeners.delete(setMessage); };
  }, []);
  const shown = message !== null;
  return (
    <div
      role={shown ? 'status' : undefined}
      aria-hidden={shown ? undefined : true}
      aria-live="polite"
      style={{
        position: 'fixed', zIndex: 80, left: desktop ? '50%' : 16, right: desktop ? 'auto' : 16,
        transform: desktop ? 'translateX(-50%)' : undefined, maxWidth: desktop ? 560 : undefined,
        bottom: `calc(var(--safe-bottom) + ${desktop ? 24 : 100}px)`,
        opacity: shown ? 1 : 0, pointerEvents: 'none', transition: 'opacity .3s',
        background: 'var(--text)', color: 'var(--paper)', borderRadius: 16, padding: '13px 16px',
        fontSize: 14, fontWeight: 600, lineHeight: 1.35,
      }}
    >
      {message}
    </div>
  );
}
