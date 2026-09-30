import { useT } from '@/i18n/language';
import { categoryColor, UNCATEGORIZED_COLOR } from '@/domain/seed/categoryColor';
import { CategoryAvatar } from '@/components/ui/CategoryIcon';
import { IconCreditCard } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { localRepository } from '@/data/local/localRepository';
import { formatMoney } from '@/domain/money/format';
import { dateLabel } from '@/lib/dateLabels';
import { todayISO } from '@/lib/todayISO';
import { buildCalendarGrid } from './calendarGrid';
import { EMPTY } from '@/lib/empty';

/**
 * The month grid and the selected day's list. It used to be its own screen
 * (CalendarScreen); now it is the "Calendario" view of Movimientos, which
 * owns the month navigator and passes the month in. `/calendario` redirects
 * to `/movimientos?vista=calendario`.
 */
export function CalendarView({ year: viewYear, month: viewMonth }: { year: number; month: number }) {
  const t = useT();
  const weekdays = t('calendar.weekdays').split(',');
  const today = todayISO();
  const [year, month] = today.split('-').map(Number) as [number, number];
  const [selected, setSelected] = useState(today);

  // Coming back to the current month also selects today: returning to the
  // month and staying parked on some day from another month would be a
  // half-hearted return.
  const inCurrentMonth = viewYear === year && viewMonth === month;
  useEffect(() => {
    if (inCurrentMonth) setSelected(today);
  }, [inCurrentMonth, today]);

  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const markersByDate = useMemo(() => {
    const map = new Map<string, { income: boolean; expense: boolean; tcPayment: boolean }>();
    const ensure = (date: string) => {
      let m = map.get(date);
      if (!m) { m = { income: false, expense: false, tcPayment: false }; map.set(date, m); }
      return m;
    };
    for (const tx of transactions) {
      if (tx.status === 'cancelled') continue;
      const m = ensure(tx.date);
      if (tx.type === 'income') m.income = true; else m.expense = true;
      if (tx.cyclePaymentDate) ensure(tx.cyclePaymentDate).tcPayment = true;
    }
    return map;
  }, [transactions]);

  const cells = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const dayTransactions = transactions.filter((t) => t.date === selected);
  const dayPayments = transactions.filter((t) => t.cyclePaymentDate === selected && t.date !== selected);
  // The day's net: what came in minus what went out (cancelled ones aside).
  const dayNet = dayTransactions.reduce(
    (sum, tx) => (tx.status === 'cancelled' ? sum : sum + (tx.type === 'income' ? tx.amount : -tx.amount)),
    0,
  );

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {weekdays.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-faint)', fontWeight: 600 }}>{w}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 20 }}>
        {cells.map((cell) => {
          const marker = markersByDate.get(cell.date);
          const isSelected = cell.date === selected;
          const isToday = cell.date === today;
          const dayNum = Number(cell.date.slice(8, 10));
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => setSelected(cell.date)}
              aria-pressed={isSelected}
              style={{
                minHeight: 48, border: 'none', background: 'transparent', padding: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer',
                opacity: cell.inMonth ? 1 : 0.35,
              }}
            >
              <span
                style={{
                  width: 34, height: 34, borderRadius: 17, display: 'grid', placeItems: 'center',
                  background: isSelected ? 'var(--text)' : 'transparent',
                  color: isSelected ? 'var(--paper)' : isToday ? 'var(--q10-text)' : (cell.inMonth ? 'var(--text)' : 'var(--text-faint)'),
                  fontSize: 15, fontWeight: isToday || isSelected ? 700 : 500,
                }}
              >
                {dayNum}
              </span>
              {/* At most three dots: income, expense, card payment. */}
              <span style={{ display: 'flex', gap: 3, height: 4 }}>
                {marker?.income && <Dot color="var(--positive)" />}
                {marker?.expense && <Dot color="var(--text-faint)" />}
                {marker?.tcPayment && <Dot color="var(--q25)" />}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, margin: '0 0 10px' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, margin: 0 }}>
          {dateLabel(selected, t, 'long')}
        </h2>
        {dayTransactions.length > 0 && (
          <span className="figures" style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: dayNet >= 0 ? 'var(--positive-text)' : 'var(--text-muted)' }}>
            {dayNet > 0 ? '+ ' : dayNet < 0 ? '− ' : ''}{formatMoney(Math.abs(dayNet))}
          </span>
        )}
      </div>

      {dayTransactions.length === 0 && dayPayments.length === 0 ? (
        <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>{t('calendar.noTransactionsToday')}</p>
      ) : (
        <div className="divided" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: '4px 14px' }}>
          {dayTransactions.map((tx) => {
            const cat = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
            return (
              <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
                <CategoryAvatar
                  icon={cat?.icon ?? 'other'}
                  color={cat ? categoryColor(cat) : UNCATEGORIZED_COLOR}
                  size={32}
                />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.concept}</span>
                <span className="figures" style={{ fontWeight: 600, color: tx.type === 'income' ? 'var(--positive-text)' : 'var(--text)' }}>
                  {tx.type === 'income' ? '+' : ''}{formatMoney(tx.amount)}
                </span>
              </div>
            );
          })}
          {dayPayments.map((tx) => (
            <div key={`pay-${tx.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
              <span
                aria-hidden
                style={{
                  flex: 'none', width: 32, height: 32, borderRadius: 11, display: 'grid',
                  placeItems: 'center', background: 'var(--q25-soft)', color: 'var(--q25-text)',
                }}
              >
                <IconCreditCard size={17} stroke={1.75} />
              </span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--q25-text)' }}>
                {t('calendar.cardPayment')}: {tx.concept}
              </span>
              <span className="figures" style={{ fontWeight: 600 }}>{formatMoney(tx.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Dot({ color }: { color: string }) {
  return <span aria-hidden style={{ width: 4, height: 4, borderRadius: 2, background: color, display: 'inline-block' }} />;
}
