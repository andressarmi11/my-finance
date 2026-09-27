import { IconAlertTriangle, IconCloudUpload } from '@tabler/icons-react';
import type { EstadoSync } from '@/data/sync/useCloudSync';

/**
 * Solo aparece cuando hay algo que decir: sincronizando o fallo. En verde
 * y permanente seria ruido — que funcione es lo normal, no una noticia.
 */
export function SyncIndicator({ estado, error, onReintentar }: {
  estado: EstadoSync;
  error: string;
  onReintentar: () => void;
}) {
  if (estado !== 'sincronizando' && estado !== 'error') return null;
  const esError = estado === 'error';

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
        background: esError ? 'var(--danger-soft)' : 'var(--surface)',
        border: `1px solid ${esError ? 'var(--danger)' : 'var(--line-strong)'}`,
        boxShadow: 'var(--shadow-2)',
        fontSize: 'var(--text-sm)',
        color: 'var(--text)',
      }}
    >
      {esError
        ? <IconAlertTriangle size={16} stroke={1.9} aria-hidden />
        : <IconCloudUpload size={16} stroke={1.9} aria-hidden />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {esError ? (error || 'No se pudo sincronizar') : 'Sincronizando…'}
      </span>
      {esError && (
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
