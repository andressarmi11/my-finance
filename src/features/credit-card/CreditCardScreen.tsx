import { useT } from '@/i18n/language';
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
import type { AvailableCredit } from '@/domain/credit-card/availableCredit';
import type { PaymentMethod, Transaction } from '@/domain/types';
import { formatShortDate } from '@/lib/formatShortDate';
import { nowISO, todayISO } from '@/lib/todayISO';
import { haptic } from '@/lib/haptic';
import { EMPTY } from '@/lib/empty';

/**
 * One section per card, with the cycles inside it.
 *
 * It used to lump the purchases from ALL cards into a single cycle
 * timeline: with two cards that pay on the same day, it added up money in
 * one row that gets paid separately, and the rows didn't even say which
 * card they belonged to. See domain/credit-card/groupByCycle.ts
 * (groupByCard).
 */
export function CreditCardScreen() {
  const t = useT();
  const navigate = useNavigate();
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? EMPTY;
  const paymentMethods = useLiveQuery(() => localRepository.listPaymentMethods(), []) ?? EMPTY;
  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const today = todayISO();
  const cards = useMemo(
    () => groupByCard(paymentMethods, transactions, today),
    [paymentMethods, transactions, today],
  );

  /** Marking the cycle paid is what frees up the credit. There is no
   *  "statement" entity: it's the status of its transactions. */
  async function markCyclePaid(cycle: CreditCycleGroup) {
    haptic('medium');
    for (const tx of cycle.transactions) {
      if (tx.status === 'paid') continue;
      await localRepository.saveTransaction({ ...tx, status: 'paid', updatedAt: nowISO() });
    }
  }

  const noCards = cards.length === 0;
  const noPurchases = cards.every((c) => c.cycles.length === 0);

  return (
    <Screen title={t('cards.title')} subtitle={t('cards.subtitle')}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16, background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
      >
        ← {t('nav.back')}
      </button>

      {noCards ? (
        <EmptyState
          title={t('cards.noCards')}
          body={t('cards.addOneInSettings')}
        />
      ) : noPurchases ? (
        <EmptyState
          title={t('cards.noPurchases')}
          body={t('cards.noPurchasesBody')}
        />
      ) : (
        cards.map(({ card, available, cycles }) => (
          <CardSection
            key={card.id}
            card={card}
            available={available}
            cycles={cycles}
            today={today}
            categoryById={categoryById}
            onMarkPaid={markCyclePaid}
          />
        ))
      )}
    </Screen>
  );
}

function CardSection({ card, available, cycles, today, categoryById, onMarkPaid }: {
  card: PaymentMethod;
  available: AvailableCredit | null;
  cycles: CreditCycleGroup[];
  today: string;
  categoryById: Map<string, { icon: string }>;
  onMarkPaid: (cycle: CreditCycleGroup) => void;
}) {
  const t = useT();
  return (
    <section style={{ marginBottom: 'var(--gap-xl)' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 700 }}>{card.name}</h2>
        {available && (
          <span style={{ textAlign: 'right' }}>
            <span className="figures" style={{ fontWeight: 700, color: available.available >= 0 ? 'var(--text)' : 'var(--danger-text)' }}>
              {formatMoney(available.available)}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}> de {formatMoney(available.cupo)}</span>
          </span>
        )}
      </header>

      {cycles.length === 0 ? (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-faint)', margin: 0 }}>{t('cards.noPurchasesYet')}</p>
      ) : (
        cycles.map((cycle) => {
          const isNext = cycle.paymentDate >= today;
          const overdue = cycle.paymentDate < today && cycle.transactions.some((t) => t.status !== 'paid');
          const { day, month } = formatShortDate(cycle.paymentDate);
          return (
            <div key={cycle.paymentDate} style={{ background: overdue ? 'var(--danger-soft)' : isNext ? 'var(--q25-soft)' : 'var(--surface-sunken)', borderRadius: 'var(--radius-m)', padding: '12px 14px 4px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: overdue ? 'var(--danger-text)' : isNext ? 'var(--q25)' : 'var(--text-muted)' }}>
                  {overdue ? t('cards.overdueOn') : t('cards.dueOn')} {day} {month}
                </span>
                <span className="figures" style={{ fontWeight: 700, fontSize: 17 }}>{formatMoney(cycle.total)}</span>
              </div>

              {cycle.transactions.map((tx) => (
                <PurchaseRow key={tx.id} tx={tx} icon={tx.categoryId ? categoryById.get(tx.categoryId)?.icon : undefined} />
              ))}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0 6px' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {cycle.count} {cycle.count === 1 ? t('cards.purchase') : t('cards.purchases')} {t('cards.inThisCycle')}
                </span>
                {cycle.transactions.some((t) => t.status !== 'paid') && (
                  <button
                    type="button"
                    onClick={() => onMarkPaid(cycle)}
                    style={{ minHeight: 32, padding: '0 10px', borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                  >
                    {t('cards.markPaid')}
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

function PurchaseRow({ tx, icon }: { tx: Transaction; icon?: string }) {
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
