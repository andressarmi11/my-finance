import { useT } from '@/i18n/language';
import { categoryColor, UNCATEGORIZED_COLOR } from '@/domain/seed/categoryColor';
import { CategoryAvatar } from '@/components/ui/CategoryIcon';
import { IconCreditCard } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { MonthNav, monthName, widestMonthLabel } from '@/components/ui/MonthNav';
import { db } from '@/data/db';
import { localRepository } from '@/data/local/localRepository';
import { formatMoney } from '@/domain/money/format';
import { formatShortDate } from '@/lib/formatShortDate';
import { todayISO } from '@/lib/todayISO';
import { buildCalendarGrid, shiftMonthISO } from './calendarGrid';
import { EMPTY } from '@/lib/empty';

const WEEKDAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export function CalendarScreen() {
  const t = useT();
  const today = todayISO();
  const [year, month] = today.split('-').map(Number) as [number, number];
  const [view, setView] = useState({ year, month });
  const [selected, setSelected] = useState(today);

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

  const cells = useMemo(() => buildCalendarGrid(view.year, view.month), [view]);
  const inCurrentMonth = view.year === year && view.month === month;

  const dayTransactions = transactions.filter((t) => t.date === selected);
  const dayPayments = transactions.filter((t) => t.cyclePaymentDate === selected && t.date !== selected);

  return (
    <Screen title={t('calendar.title')} subtitle={t('calendar.subtitle')}>
      {/* MonthNav and not a local copy: this screen used to have its own
          inline navigation, and that's why it was left without the Today button when the
          shared component gained one. */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <MonthNav
          label={`${monthName(view.month)} ${view.year}`}
          widthSample={widestMonthLabel()}
          todayIsAhead={view.year * 12 + view.month < year * 12 + month}
          onPrev={() => setView((v) => shiftMonthISO(v.year, v.month, -1))}
          onNext={() => setView((v) => shiftMonthISO(v.year, v.month, 1))}
          onToday={inCurrentMonth ? undefined : () => {
            setView({ year, month });
            // Today also gets selected: going back to the month and staying
            // parked on some day from the past month would be a half-hearted return.
            setSelected(today);
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-faint)', fontWeight: 600 }}>{w}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 20 }}>
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
              style={{
                aspectRatio: '1', borderRadius: 10, border: isToday ? '1.5px solid var(--text)' : '1px solid transparent',
                background: isSelected ? 'var(--text)' : 'transparent', color: isSelected ? 'var(--surface)' : (cell.inMonth ? 'var(--text)' : 'var(--text-faint)'),
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer',
                opacity: cell.inMonth ? 1 : 0.35,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500 }}>{dayNum}</span>
              <span style={{ display: 'flex', gap: 2, height: 4 }}>
                {marker?.income && <Dot color={isSelected ? 'var(--surface)' : 'var(--positive-text)'} />}
                {marker?.expense && <Dot color={isSelected ? 'var(--surface)' : 'var(--text-muted)'} />}
                {marker?.tcPayment && <Dot color={isSelected ? 'var(--surface)' : 'var(--q25)'} />}
              </span>
            </button>
          );
        })}
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>
        {formatShortDate(selected).day} de {formatShortDate(selected).month}
      </h2>

      {dayTransactions.length === 0 && dayPayments.length === 0 ? (
        <p style={{ color: 'var(--text-faint)', fontSize: 13 }}>{t('calendar.noTransactionsToday')}</p>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', padding: '4px 14px' }}>
          {dayTransactions.map((tx) => {
            const cat = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
            return (
              <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
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
            <div key={`pay-${tx.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
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
                Pago TC: {tx.concept}
              </span>
              <span className="figures" style={{ fontWeight: 600 }}>{formatMoney(tx.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}

function Dot({ color }: { color: string }) {
  return <span aria-hidden style={{ width: 4, height: 4, borderRadius: 2, background: color, display: 'inline-block' }} />;
}
