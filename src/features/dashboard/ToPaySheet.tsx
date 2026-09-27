import { useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { useNavigate } from 'react-router-dom';
import type { Transaction } from '@/domain/types';
import type { PorPagar } from '@/domain/totals/porPagar';
import { formatMoney } from '@/domain/money/format';

/**
 * Sheet de desglose del chip "Por pagar".
 *
 * Recibe el desglose YA calculado, con los conjuntos disjuntos. Antes
 * recibía tres listas que se solapaban y volvía a sumarlas acá, así que
 * mostraba más plata que el número que lo abrió y listaba el mismo
 * movimiento dos veces. Ver domain/totals/porPagar.ts.
 */
export function PorPagarSheet({
  porPagar,
  onClose,
}: {
  porPagar: PorPagar;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  const { pendientes, programados, enTarjeta: enTC } = porPagar;
  const sum = (arr: Transaction[]) => arr.reduce((a, t) => a + t.amount, 0);
  const total = porPagar.count;
  const totalAmount = porPagar.monto;

  const refDialogo = useDialogo(onClose);
  return (
    <div
      ref={refDialogo}
      role="dialog"
      aria-label="Por pagar — desglose"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in srgb, black 40%, transparent)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 60,
        animation: 'fadeIn var(--dur-fast) var(--ease-spring-out)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          padding: '10px 16px calc(var(--safe-bottom) + 16px)',
          animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 12px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>Por pagar</h2>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            aria-label="¿Qué significan estos estados?"
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              border: '1px solid var(--line-strong)',
              background: 'var(--surface)',
              color: 'var(--text-muted)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ?
          </button>
        </div>

        {showHelp && (
          <div style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-s)', padding: '12px 14px', marginBottom: 12, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 'var(--lh-normal)' }}>
            <p style={{ margin: '0 0 6px' }}>
              <strong style={{ color: 'var(--text)' }}>Pendiente:</strong> gasto que existe pero aún no lo pagaste.
            </p>
            <p style={{ margin: '0 0 6px' }}>
              <strong style={{ color: 'var(--text)' }}>Programado:</strong> gasto agendado a fecha futura.
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: 'var(--text)' }}>En tarjeta:</strong> compra con TC que se cobrará en la fecha de pago del ciclo.
            </p>
          </div>
        )}

        <BreakdownRow label="Pendientes" count={pendientes.length} amount={sum(pendientes)} onClick={() => { navigate('/movimientos?estado=pending'); onClose(); }} />
        <BreakdownRow label="Programados" count={programados.length} amount={sum(programados)} onClick={() => { navigate('/movimientos?estado=scheduled'); onClose(); }} />
        <BreakdownRow label="En tarjeta" count={enTC.length} amount={sum(enTC)} onClick={() => { navigate('/tarjeta'); onClose(); }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 8px 4px', borderTop: '1px solid var(--line-strong)', marginTop: 4 }}>
          <span style={{ fontWeight: 700 }}>Total por pagar</span>
          <span className="figures" style={{ fontWeight: 700 }}>
            {total} · {formatMoney(totalAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}

function BreakdownRow({ label, count, amount, onClick }: { label: string; count: number; amount: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 8px',
        background: 'none',
        border: 'none',
        borderBottom: '1px solid var(--line)',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'var(--text)',
      }}
    >
      <span>{label}</span>
      <span className="figures" style={{ color: 'var(--text-muted)' }}>
        <span style={{ marginRight: 12 }}>{count}</span>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{formatMoney(amount)}</span>
        <span style={{ marginLeft: 8, color: 'var(--text-faint)' }}>›</span>
      </span>
    </button>
  );
}
