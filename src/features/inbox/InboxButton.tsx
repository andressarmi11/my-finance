import { IconInbox } from '@tabler/icons-react';
import { useT } from '@/i18n/language';
import { useInboxContext } from './InboxProvider';

/**
 * Inicio's header entry to the inbox (BANDEJA.md): always there when signed
 * in to the cloud, with an amber count while something waits.
 */
export function InboxButton() {
  const t = useT();
  const { enabled, items, openAt } = useInboxContext();
  if (!enabled) return null;
  const n = items.length;
  return (
    <button
      type="button"
      onClick={() => openAt()}
      aria-label={n > 0 ? `${t('inbox.reviewTitle')}: ${n}` : t('inbox.reviewTitle')}
      className="row-hover"
      style={{
        position: 'relative', flex: 'none', width: 36, height: 36, borderRadius: 18, padding: 0,
        border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text-muted)',
        display: 'grid', placeItems: 'center', cursor: 'pointer',
      }}
    >
      <IconInbox size={18} stroke={1.9} aria-hidden />
      {n > 0 && (
        <span
          aria-hidden
          className="figures"
          style={{
            position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, padding: '0 4px',
            boxSizing: 'border-box', background: 'var(--q25)', color: 'var(--paper)',
            fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center',
          }}
        >
          {n}
        </span>
      )}
    </button>
  );
}
