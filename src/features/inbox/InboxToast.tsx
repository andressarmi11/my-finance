import { useBreakpoint } from '@/app/useBreakpoint';
import { useT } from '@/i18n/language';

/**
 * "Anotado · Uber $ 18.000 — Deshacer", for 5 s (BANDEJA.md). It's what
 * lets Descartar go without a confirmation. Over the sheet while it's
 * open; above the tab bar once it closes.
 */
export function InboxToast({ toast, sheetOpen, onUndo }: {
  toast: { message: string; undo?: unknown } | null;
  sheetOpen: boolean;
  onUndo: () => void;
}) {
  const t = useT();
  const desktop = useBreakpoint() === 'desktop';
  const shown = toast !== null;
  const bottom = !shown ? 70 : sheetOpen || desktop ? 24 : 100;
  return (
    <div
      // A status only while it says something: an empty live region would be
      // one more "status" on every screen.
      role={shown ? 'status' : undefined}
      aria-hidden={shown ? undefined : true}
      aria-live="polite"
      style={{
        position: 'fixed', zIndex: 70,
        left: desktop ? '50%' : 16, right: desktop ? 'auto' : 16,
        width: 'auto', maxWidth: desktop ? 560 : undefined, transform: desktop ? 'translateX(-50%)' : undefined,
        whiteSpace: 'nowrap',
        bottom: `calc(var(--safe-bottom) + ${bottom}px)`,
        opacity: shown ? 1 : 0, pointerEvents: shown ? 'auto' : 'none',
        transition: 'all .3s cubic-bezier(.22,1,.36,1)',
        background: 'var(--text)', color: 'var(--paper)', borderRadius: desktop ? 14 : 16,
        padding: '0 6px 0 16px', height: desktop ? 46 : 48, display: 'flex', alignItems: 'center', gap: desktop ? 10 : 8,
        fontSize: 14, fontWeight: 600,
      }}
    >
      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {toast?.message}
      </span>
      {toast?.undo ? (
        <button
          type="button"
          onClick={onUndo}
          style={{
            border: 'none', background: 'none', cursor: 'pointer', height: 36, padding: '0 10px',
            color: 'var(--toast-action)', fontWeight: 700, fontSize: 14,
          }}
        >
          {t('inbox.undo')}
        </button>
      ) : null}
    </div>
  );
}
