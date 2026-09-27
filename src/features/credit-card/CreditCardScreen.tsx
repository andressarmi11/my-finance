import { useT } from '@/i18n/idioma';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { db } from '@/data/db';
import { localRepository } from '@/data/local/localRepository';
import { formatMoney } from '@/domain/money/format';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { groupByCard, type CreditCycleGroup } from '@/domain/credit-card/groupByCycle';
import type { Disponible } from '@/domain/credit-card/disponible';
import type { PaymentMethod, Transaction } from '@/domain/types';
import { formatShortDate } from '@/lib/formatShortDate';
import { nowISO, todayISO } from '@/lib/todayISO';
import { haptic } from '@/lib/haptic';
import { VACIO } from '@/lib/vacio';

/**
 * Una seccion por tarjeta, y los ciclos adentro.
 *
 * Antes juntaba las compras de TODAS las tarjetas en un solo timeline de
 * ciclos: con dos tarjetas que pagan el mismo dia, sumaba en una fila
 * plata que se paga por separado, y las filas ni decian de que tarjeta
 * eran. Ver domain/credit-card/groupByCycle.ts (groupByCard).
 */
export function CreditCardScreen() {
  const t = useT();
  const navigate = useNavigate();
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? VACIO;
  const paymentMethods = useLiveQuery(() => localRepository.listPaymentMethods(), []) ?? VACIO;
  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? VACIO;
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const today = todayISO();
  const cards = useMemo(
    () => groupByCard(paymentMethods, transactions, today),
    [paymentMethods, transactions, today],
  );

  /** Marcar el ciclo pagado es lo que libera el cupo. No hay entidad
   *  "extracto": es el status de sus movimientos. */
  async function marcarCicloPagado(cycle: CreditCycleGroup) {
    haptic('medium');
    for (const tx of cycle.transactions) {
      if (tx.status === 'paid') continue;
      await localRepository.saveTransaction({ ...tx, status: 'paid', updatedAt: nowISO() });
    }
  }

  const sinTarjetas = cards.length === 0;
  const sinCompras = cards.every((c) => c.cycles.length === 0);

  return (
    <Screen title={t('tarjetas.titulo')} subtitle={t('tarjetas.subtitulo')}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16, background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
      >
        ← {t('nav.volver')}
      </button>

      {sinTarjetas ? (
        <EmptyState
          title={t('tarjetas.sinTarjetas')}
          body="Agrega una en Ajustes → Métodos de pago, con su día de corte y su día de pago."
        />
      ) : sinCompras ? (
        <EmptyState
          title={t('tarjetas.sinCompras')}
          body="Cuando registres un gasto con tarjeta de crédito, aquí verás cada compra y el total que se paga en cada ciclo."
        />
      ) : (
        cards.map(({ tarjeta, disponible, cycles }) => (
          <TarjetaSection
            key={tarjeta.id}
            tarjeta={tarjeta}
            disponible={disponible}
            cycles={cycles}
            today={today}
            categoryById={categoryById}
            onMarcarPagado={marcarCicloPagado}
          />
        ))
      )}
    </Screen>
  );
}

function TarjetaSection({ tarjeta, disponible, cycles, today, categoryById, onMarcarPagado }: {
  tarjeta: PaymentMethod;
  disponible: Disponible | null;
  cycles: CreditCycleGroup[];
  today: string;
  categoryById: Map<string, { icon: string }>;
  onMarcarPagado: (cycle: CreditCycleGroup) => void;
}) {
  const t = useT();
  return (
    <section style={{ marginBottom: 'var(--gap-xl)' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 700 }}>{tarjeta.name}</h2>
        {disponible && (
          <span style={{ textAlign: 'right' }}>
            <span className="figures" style={{ fontWeight: 700, color: disponible.disponible >= 0 ? 'var(--text)' : 'var(--danger-text)' }}>
              {formatMoney(disponible.disponible)}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}> de {formatMoney(disponible.cupo)}</span>
          </span>
        )}
      </header>

      {cycles.length === 0 ? (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-faint)', margin: 0 }}>{t('tarjetas.sinComprasAun')}</p>
      ) : (
        cycles.map((cycle) => {
          const isNext = cycle.paymentDate >= today;
          const vencido = cycle.paymentDate < today && cycle.transactions.some((t) => t.status !== 'paid');
          const { day, month } = formatShortDate(cycle.paymentDate);
          return (
            <div key={cycle.paymentDate} style={{ background: vencido ? 'var(--danger-soft)' : isNext ? 'var(--q25-soft)' : 'var(--surface-sunken)', borderRadius: 'var(--radius-m)', padding: '12px 14px 4px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: vencido ? 'var(--danger-text)' : isNext ? 'var(--q25)' : 'var(--text-muted)' }}>
                  {vencido ? t('tarjetas.vencioEl') : t('tarjetas.sePagaEl')} {day} {month}
                </span>
                <span className="figures" style={{ fontWeight: 700, fontSize: 17 }}>{formatMoney(cycle.total)}</span>
              </div>

              {cycle.transactions.map((tx) => (
                <CompraRow key={tx.id} tx={tx} icon={tx.categoryId ? categoryById.get(tx.categoryId)?.icon : undefined} />
              ))}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0 6px' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {cycle.count} {cycle.count === 1 ? t('tarjetas.compra') : t('tarjetas.compras')} {t('tarjetas.enEsteCiclo')}
                </span>
                {cycle.transactions.some((t) => t.status !== 'paid') && (
                  <button
                    type="button"
                    onClick={() => onMarcarPagado(cycle)}
                    style={{ minHeight: 32, padding: '0 10px', borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                  >
                    {t('tarjetas.marcarPagado')}
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}

function CompraRow({ tx, icon }: { tx: Transaction; icon?: string }) {
  const { day, month } = formatShortDate(tx.date);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--line)', opacity: tx.status === 'paid' ? 0.55 : 1 }}>
      <CategoryIcon icon={icon} size={18} color="var(--text-faint)" />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>{tx.concept}</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{day} {month}</span>
      <span className="figures" style={{ fontWeight: 600, fontSize: 14 }}>{formatMoney(tx.amount)}</span>
    </div>
  );
}
