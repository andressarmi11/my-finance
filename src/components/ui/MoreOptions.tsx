import { useId, useState, type ReactNode } from 'react';
import { useT } from '@/i18n/language';

/**
 * "More options" disclosure. The content is NOT rendered while closed, so
 * hidden fields can't be tabbed into or read out. `startOpen` is for editing
 * something that already uses an advanced setting: hiding a non-default
 * value would make the form lie about what it saves.
 */
export function MoreOptions({ children, startOpen = false }: { children: ReactNode; startOpen?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(startOpen);
  const id = useId();
  return (
    <div style={{ marginBottom: open ? 14 : 6 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, minHeight: 'var(--tap)', padding: '0 4px',
          background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 600,
          fontSize: 'var(--text-sm)', cursor: 'pointer',
        }}
      >
        {/* Fixed label: aria-expanded already says the state. */}
        {t('more.open')}
        <span aria-hidden style={{ display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none' }}>⌄</span>
      </button>
      <div id={id}>{open && children}</div>
    </div>
  );
}
