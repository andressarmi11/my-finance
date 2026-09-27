import { IconBolt } from '@tabler/icons-react';
import { useState } from 'react';
import { InboxSheet } from './InboxSheet';
import { useInbox } from './useInbox';

/**
 * Avisa que llegó algo de una automatización. Solo aparece cuando hay
 * algo: una barra permanente diciendo "0 pendientes" sería ruido.
 */
export function InboxBanner() {
  const { pendientes, recargar } = useInbox();
  const [abierto, setAbierto] = useState(false);

  if (pendientes.length === 0) return null;
  const n = pendientes.length;

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
          <strong>{n} {n === 1 ? 'movimiento llegó solo' : 'movimientos llegaron solos'}</strong>
          {' '}— tócalo para revisarlo.
        </span>
        <span aria-hidden style={{ color: 'var(--q25-text)', fontSize: 20 }}>›</span>
      </button>

      {abierto && (
        <InboxSheet
          entradas={pendientes}
          onClose={() => setAbierto(false)}
          onCambio={() => { void recargar(); }}
        />
      )}
    </>
  );
}
