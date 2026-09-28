import { IconAlertTriangle, IconCloudUpload } from '@tabler/icons-react';
import type { SyncStatus } from '@/data/sync/useCloudSync';
import { translate } from '@/i18n/language';

/**
 * Only shows up when there's something to say: syncing or a failure. Green
 * and permanent would be noise — working is the normal state, not news.
 */
export function SyncIndicator({ status, error, onReintentar }: {
  status: SyncStatus;
  error: string;
  onReintentar: () => void;
}) {
  if (status !== 'sincronizando' && status !== 'error') return null;
  const isError = status === 'error';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'calc(var(--safe-bottom) + 76px)',
        zIndex: 45,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        maxWidth: 'calc(100vw - 32px)',
        padding: '8px 14px',
        borderRadius: 999,
        background: isError ? 'var(--danger-soft)' : 'var(--surface)',
        border: `1px solid ${isError ? 'var(--danger)' : 'var(--line-strong)'}`,
        boxShadow: 'var(--shadow-2)',
        fontSize: 'var(--text-sm)',
        color: 'var(--text)',
      }}
    >
      {isError
        ? <IconAlertTriangle size={16} stroke={1.9} aria-hidden />
        : <IconCloudUpload size={16} stroke={1.9} aria-hidden />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {isError ? (error || translate('sync.couldNotSync')) : 'Sincronizando…'}
      </span>
      {isError && (
        <button
          type="button"
          onClick={onReintentar}
          style={{
            border: 'none', background: 'none', color: 'var(--q10-text)',
            fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', padding: '0 2px',
          }}
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
