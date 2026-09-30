import { IconInbox } from '@tabler/icons-react';
import { useT } from '@/i18n/language';
import { useInboxContext } from './InboxProvider';

/**
 * Inicio's header entry to the inbox: always there when signed in to the
 * cloud, with an amber count while something waits. On the phone a 36 px
 * circle beside the month (BANDEJA.md 3b); on desktop a 40 px square
 * between the search and "Nuevo movimiento" (BANDEJA-WEB.md 4a).
 */
export function InboxButton({ desktop = false }: { desktop?: boolean }) {
  const t = useT();
  const { enabled, items, openAt } = useInboxContext();
  if (!enabled) return null;
  const n = items.length;
  const size = desktop ? 40 : 36;
  return (
    <button
      type="button"
      onClick={() => openAt()}
      aria-label={n > 0 ? `${t('inbox.openPanel')}: ${n}` : t('inbox.openPanel')}
      className="row-hover"
      style={{
        position: 'relative', flex: 'none', width: size, height: size, borderRadius: desktop ? 12 : 18, padding: 0,
        border: `1px solid ${desktop ? 'var(--line-strong)' : 'var(--line)'}`, background: 'var(--surface)',
        color: 'var(--text-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer',
      }}
    >
      <IconInbox size={desktop ? 19 : 18} stroke={1.9} aria-hidden />
      {n > 0 && (
        <span
          aria-hidden
          className="figures"
          style={{
            position: 'absolute', top: desktop ? -5 : -4, right: desktop ? -5 : -4, minWidth: 18, height: 18,
            borderRadius: 9, padding: '0 4px', boxSizing: 'border-box', background: 'var(--q25)', color: 'var(--paper)',
            fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center',
          }}
        >
          {n}
        </span>
      )}
    </button>
  );
}

/**
 * The sidebar's "Por revisar" (BANDEJA-WEB.md 4a): under the three tabs,
 * after a 1 px line. Not a route — it opens the panel, from any screen.
 */
export function InboxNavItem() {
  const t = useT();
  const { enabled, items, open, openAt } = useInboxContext();
  if (!enabled) return null;
  const n = items.length;
  return (
    <>
      <div aria-hidden style={{ height: 1, background: 'var(--line)', margin: '10px 8px' }} />
      <button
        type="button"
        onClick={() => openAt()}
        aria-label={n > 0 ? `${t('inbox.openPanel')}: ${n}` : t('inbox.openPanel')}
        aria-expanded={open}
        className="row-hover"
        style={{
          display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 14px', borderRadius: 12,
          border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: 600, fontSize: 15,
          background: open ? 'var(--surface-sunken)' : 'transparent', color: open ? 'var(--text)' : 'var(--text-muted)',
        }}
      >
        <IconInbox size={20} stroke={1.8} aria-hidden />
        <span style={{ flex: 1 }}>{t('inbox.navTitle')}</span>
        {n > 0 && (
          <span
            aria-hidden
            className="figures"
            style={{
              minWidth: 22, height: 22, borderRadius: 11, padding: '0 6px', boxSizing: 'border-box',
              background: 'var(--q25)', color: 'var(--paper)', fontSize: 12, fontWeight: 700,
              display: 'grid', placeItems: 'center',
            }}
          >
            {n}
          </span>
        )}
      </button>
    </>
  );
}
