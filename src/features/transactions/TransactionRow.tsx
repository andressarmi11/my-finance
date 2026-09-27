import type { Category, PaymentMethod, Transaction } from '@/domain/types';
import { formatMoney } from '@/domain/money/format';
import { formatShortDate } from '@/lib/formatShortDate';

function shortDate(iso: string): string {
  const { day, month } = formatShortDate(iso);
  return `${day} ${month}`;
}

/**
 * Fila de movimiento. El monto va en la MISMA linea que el concepto y el
 * estado debajo, a la derecha: antes el monto y el estado ocupaban una
 * columna propia y le robaban ancho al texto, asi que casi todos los
 * conceptos y subtitulos salian truncados ("Zapatos (…)", "Débi…").
 */
export function TransactionRow({
  tx, category, paymentMethod, onTogglePaid, onOpen, seleccionado, onSeleccionar,
}: {
  tx: Transaction;
  category: Category | undefined;
  paymentMethod: PaymentMethod | undefined;
  onTogglePaid: () => void;
  onOpen: () => void;
  /** Con valor, la fila esta en modo seleccion: el circulo elige en vez de
   *  marcar pagado, y tocar la fila tambien elige en vez de abrir el form. */
  seleccionado?: boolean;
  onSeleccionar?: () => void;
}) {
  const enSeleccion = onSeleccionar !== undefined;
  const isIncome = tx.type === 'income';
  const isPaid = tx.status === 'paid';
  const isCredit = paymentMethod?.type === 'credit';

  // En seleccion el circulo es azul (elegir); fuera de seleccion, verde
  // (ya esta pagado). Dos significados, dos colores.
  const marcado = enSeleccion ? Boolean(seleccionado) : isPaid;
  const colorMarca = enSeleccion ? 'var(--q10)' : 'var(--positive)';

  const meta = [category?.name, shortDate(tx.date), paymentMethod?.name].filter(Boolean).join(' · ');

  const statusLabel =
    isPaid ? (isIncome ? 'Recibido' : 'Pagado')
    : tx.status === 'scheduled' ? 'Programado'
    : tx.status === 'cancelled' ? 'Cancelado'
    : 'Pendiente';

  const statusColor =
    isPaid ? 'var(--positive)'
    : tx.status === 'cancelled' ? 'var(--text-faint)'
    : tx.status === 'scheduled' ? 'var(--committed)'
    : 'var(--text-faint)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
      <button
        type="button"
        onClick={enSeleccion ? onSeleccionar : onTogglePaid}
        aria-pressed={enSeleccion ? Boolean(seleccionado) : isPaid}
        aria-label={enSeleccion
          ? (seleccionado ? `Quitar ${tx.concept} de la selección` : `Seleccionar ${tx.concept}`)
          : isPaid
            ? `Marcar ${tx.concept} como ${isIncome ? 'no recibido' : 'pendiente'}`
            // El concepto va dentro del rotulo a proposito: con veinte
            // filas, veinte botones llamados "Marcar como pagado" no le
            // dicen nada a quien navega con lector de pantalla.
            : `Marcar ${tx.concept} como ${isIncome ? 'recibido' : 'pagado'}`}
        style={{
          width: 26, height: 26, minWidth: 26, borderRadius: 13, flex: 'none',
          // En seleccion el circulo es azul (elegir), fuera de seleccion es
          // verde (ya esta pagado). Dos significados, dos colores.
          border: `1.5px solid ${marcado ? colorMarca : 'var(--line-strong)'}`,
          background: marcado ? colorMarca : 'transparent',
          color: marcado ? '#fff' : 'transparent',
          display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 14,
          transition: 'all var(--dur-fast) var(--ease-spring-out)',
        }}
      >
        ✓
      </button>

      <button
        type="button"
        onClick={enSeleccion ? onSeleccionar : onOpen}
        style={{
          flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none',
          padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text)',
        }}
      >
        <span aria-hidden style={{ fontSize: 20, flex: 'none', width: 24, textAlign: 'center' }}>
          {category?.icon ?? (isIncome ? '💰' : '✳️')}
        </span>

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                flex: 1, minWidth: 0, fontSize: 'var(--text-md)', fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textDecoration: tx.status === 'cancelled' ? 'line-through' : undefined,
              }}
            >
              {tx.concept}
            </span>
            <span
              className="figures"
              style={{ flex: 'none', fontWeight: 700, fontSize: 'var(--text-md)', color: isIncome ? 'var(--positive-text)' : 'var(--text)' }}
            >
              {isIncome ? '+ ' : ''}{formatMoney(tx.amount)}
            </span>
          </span>

          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 1 }}>
            <span
              style={{
                flex: 1, minWidth: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {meta}
            </span>
            <span style={{ flex: 'none', fontSize: 'var(--text-xs)', color: statusColor, fontWeight: 600 }}>
              {statusLabel}
            </span>
          </span>

          {isCredit && tx.cyclePaymentDate && (
            <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--q25-text)', marginTop: 1 }}>
              se paga el {shortDate(tx.cyclePaymentDate)}
              {/* El numero vive en su campo, no dentro del concepto: meter
                  "Nevera 3/12" en el texto envenenaria el conceptIndex que
                  alimenta el autocompletado del formulario. */}
              {tx.installmentCount && tx.installmentCount > 1
                ? ` · cuota ${tx.installmentNumber} de ${tx.installmentCount}`
                : ''}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
