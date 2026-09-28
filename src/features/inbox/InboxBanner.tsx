import { IconBolt } from '@tabler/icons-react';
import { useState } from 'react';
import { InboxSheet } from './InboxSheet';
import { useInbox } from './useInbox';
import { useT } from '@/i18n/language';

/**
 * Warns that something arrived from an automation. Only shows up when there's
 * something: a permanent bar saying "0 pending" would be noise.
 */
export function InboxBanner() {
  const t = useT();
  const { pending, reload } = useInbox();
  const [abierto, setAbierto] = useState(false);

  if (pending.length === 0) return null;
  const n = pending.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: 'calc(100% - 2 * var(--gap-l))', maxWidth: 560,
          margin: '0 auto var(--gap-m)', padding: '10px 14px',
          borderRadius: 'var(--radius-m)', cursor: 'pointer',
          background: 'var(--q25-soft)', border: '1px solid var(--q25)',
          color: 'var(--text)', textAlign: 'left',
        }}
      >
        <IconBolt size={18} stroke={1.9} aria-hidden style={{ flex: 'none' }} />
        <span style={{ flex: 1, fontSize: 'var(--text-sm)' }}>
          <strong>{n} {n === 1 ? t('inbox.oneArrivedOnItsOwn') : t('inbox.manyArrivedOnTheirOwn')}</strong>
          {' '}— {t('inbox.tapToReview')}
        </span>
        <span aria-hidden style={{ color: 'var(--q25-text)', fontSize: 20 }}>›</span>
      </button>

      {abierto && (
        <InboxSheet
          entradas={pending}
          onClose={() => setAbierto(false)}
          onCambio={() => { void reload(); }}
        />
      )}
    </>
  );
}
