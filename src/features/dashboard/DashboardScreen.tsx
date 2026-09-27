import { useT } from '@/i18n/language';
import { payPeriodLabel } from '@/i18n/periodLabels';
import { IconCheck, IconCreditCardOff } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { MonthNav, monthName, widestMonthLabel } from '@/components/ui/MonthNav';
import { db } from '@/data/db';
import { localRepository, DEFAULT_SETTINGS } from '@/data/local/localRepository';
import { seedDemoTransactions } from '@/data/local/demoData';
import { ensureMonthMaterialized } from '@/data/local/materialize';
import { formatMoney } from '@/domain/money/format';
import { CategoryAvatar } from '@/components/ui/CategoryIcon';
import { categoryColor, UNCATEGORIZED_COLOR } from '@/domain/seed/categoryColor';
import { calculateMonthBalance } from '@/domain/period/balance';
import { calculateMonthFlow } from '@/domain/totals/available';
import { calculateOutstanding } from '@/domain/totals/outstanding';
import { unpaidBalances } from '@/domain/credit-card/availableCredit';
import { calculatePeriod, periodsOfMonth } from '@/domain/period/period';
import { withResolvedPeriods } from '@/domain/period/resolve';
import { shiftMonth } from '@/domain/dates';
import { formatShortDate } from '@/lib/formatShortDate';
import { todayISO, nowISO } from '@/lib/todayISO';
import { selectUpcoming, upcomingTotals, relevantDate } from './upcoming';
import { AnimatedNumber } from './AnimatedNumber';
import { ToPaySheet } from './ToPaySheet';
import { haptic } from '@/lib/haptic';
import type { Transaction } from '@/domain/types';
import { EMPTY } from '@/lib/empty';


export function DashboardScreen() {
  const t = useT();
  const navigate = useNavigate();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [porPagarOpen, setPorPagarOpen] = useState(false);

  const today = todayISO();
  const [todayYear, todayMonth] = today.split('-').map(Number) as [number, number];

  // Visible month. Starts on the current one; the arrows move it.
  // Everything below (flow, pay periods, upcoming) is recalculated for
  // THIS month.
  const [cursor, setCursor] = useState({ y: todayYear, m: todayMonth });
  const { y: year, m: month } = cursor;
  const isCurrentMonth = year === todayYear && month === todayMonth;

  // Recurring transactions are only materialized ~3 months ahead. Looking
  // at a month outside that window means they have to be created, or the
  // month comes out empty even though the rule has no end date.
  useEffect(() => { void ensureMonthMaterialized(year, month); }, [year, month]);

  const settings = useLiveQuery(() => localRepository.getSettings(), []) ?? DEFAULT_SETTINGS;
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const paymentMethods = useLiveQuery(() => localRepository.listPaymentMethods(), []) ?? EMPTY;
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const resolved = useMemo(
    () => withResolvedPeriods(transactions, settings.payDays),
    [transactions, settings.payDays],
  );

  // As many keys as the month has periods: two if you're paid biweekly,
  // one if you're paid once a month. Asking for Q1 and Q2 by hand left
  // out transactions — and crashed — as soon as the periods weren't two.
  const monthKeys = useMemo(
    () => periodsOfMonth(year, month, settings.payDays),
    [year, month, settings.payDays],
  );

  // By the CHARGE period, not the entry one: these four numbers — flow,
  // left to pay, upcoming — answer "how much money moves this month", and
  // a card purchase moves on the day the statement gets paid, not the day
  // you made it. See domain/periodo/resolve.ts.
  const monthTransactions = useMemo(
    () => resolved.filter((t) => monthKeys.includes(t.chargePeriodKey)),
    [resolved, monthKeys],
  );

  // With the pay days: without them it falls back to the default [10, 25]
  // and draws TWO periods even if you're paid once a month — the second
  // one, empty.
  const monthBalance = useMemo(
    () => calculateMonthBalance(resolved, year, month, settings.payDays),
    [resolved, year, month, settings.payDays],
  );
  const flow = useMemo(() => calculateMonthFlow(monthTransactions), [monthTransactions]);

  // Disjoint sets: a card expense counts ONCE, under card. The three
  // filters used to overlap and the chip showed an inflated count next
  // to a correct total. See domain/totals/outstanding.ts.
  const toPay = useMemo(() => calculateOutstanding(monthTransactions), [monthTransactions]);

  // Card balances that are already overdue and still not marked paid.
  // Looks at the WHOLE history, not just the month: what got forgotten
  // in June is still eating into the limit today, and that is exactly
  // what nobody remembers on their own.
  const overdue = useMemo(
    () => unpaidBalances(paymentMethods, transactions, today),
    [paymentMethods, transactions, today],
  );

  // Upcoming: the SAME month list that feeds the hero, so "left to pay"
  // up top and "expect to spend" down below always agree.
  const upcoming = useMemo(() => selectUpcoming(monthTransactions, 8), [monthTransactions]);
  const totals = useMemo(() => upcomingTotals(monthTransactions), [monthTransactions]);

  // Active pay period: asked from the domain instead of recalculated
  // here. The by-hand version (`dia < quincenaStartDays[1] ? 0 : 1`) was
  // WRONG for the first ~9 days of every month: September 3rd marked the
  // September 10th period as active, when the one still running is
  // AUGUST 25th's — which is exactly the one that crosses the month
  // boundary, the case the domain already models and has tests for.
  const todayKey = useMemo(
    () => calculatePeriod(today, settings.payDays).key,
    [today, settings.payDays],
  );
  const activePeriodIdx = monthKeys.indexOf(todayKey);
  const heroTintVar = activePeriodIdx === 1 ? '--q25-soft' : '--q10-soft';
  const heroAccentVar = activePeriodIdx === 1 ? '--q25' : '--q10';

  async function handleLoadDemo() {
    setLoadingDemo(true);
    try {
      await seedDemoTransactions();
    } finally {
      setLoadingDemo(false);
    }
  }

  async function toggleTxPaid(tx: Transaction) {
    haptic('medium');
    await localRepository.saveTransaction({
      ...tx,
      status: tx.status === 'paid' ? 'pending' : 'paid',
      updatedAt: nowISO(),
    });
  }

  const nav = (
    <MonthNav
      label={`${monthName(month)} ${year}`}
      widthSample={widestMonthLabel()}
      todayIsAhead={year * 12 + month < todayYear * 12 + todayMonth}
      onPrev={() => setCursor((c) => shiftMonth(c.y, c.m, -1))}
      onNext={() => setCursor((c) => shiftMonth(c.y, c.m, 1))}
      onToday={isCurrentMonth ? undefined : () => setCursor({ y: todayYear, m: todayMonth })}
    />
  );

  if (transactions.length === 0) {
    return (
      <Screen title={settings.displayName ? `${t('home.hello')}, ${settings.displayName}` : t('home.title')} subtitle={`${monthName(month)} ${year}`}>
        <EmptyState
          title={t('home.noTransactions')}
          body={t('home.noTransactionsBody')}
          action={{ label: loadingDemo ? t('home.loading') : t('home.loadSample'), onClick: handleLoadDemo }}
        />
      </Screen>
    );
  }

  return (
    <Screen title={settings.displayName ? `${t('home.hello')}, ${settings.displayName}` : t('home.title')} right={nav}>
      {/* Only if there is something to warn about. Everything being up
          to date is not news — same rule as SyncIndicator. */}
      {overdue.length > 0 && (
        <button
          type="button"
          onClick={() => navigate('/tarjeta')}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--danger-soft)',
            border: '1px solid color-mix(in srgb, var(--danger) 30%, var(--line))',
            borderRadius: 'var(--radius-m)', padding: '12px 14px', marginBottom: 12,
          }}
        >
          <IconCreditCardOff size={22} stroke={1.75} aria-hidden style={{ flex: 'none' }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--danger-text)' }}>
              {overdue.length === 1 ? t('home.unpaidBalance') : `${overdue.length} ${t('home.unpaidBalances')}`}
            </span>
            <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {overdue.length === 1
                ? `${overdue[0]!.card.name} · ${t('home.overdueOn')} ${formatShortDate(overdue[0]!.paymentDate).day} ${formatShortDate(overdue[0]!.paymentDate).month}`
                : t('home.markThem')}
            </span>
          </span>
          <span className="figures" style={{ flex: 'none', fontWeight: 700, color: 'var(--danger-text)' }}>
            {formatMoney(overdue.reduce((a, v) => a + v.total, 0))}
          </span>
        </button>
      )}

      {/* Hero: how the month ends up if everything goes as planned. */}
      <div
        style={{
          background: `color-mix(in srgb, var(${heroTintVar}) 65%, var(--surface))`,
          border: `1px solid color-mix(in srgb, var(${heroAccentVar}) 20%, var(--line))`,
          borderRadius: 'var(--radius-l)',
          padding: '20px 20px 16px',
          marginBottom: 12,
          boxShadow: 'var(--shadow-1)',
        }}
      >
        <p style={{ margin: '0 0 6px', fontSize: 'var(--text-sm)', color: `var(${heroAccentVar})`, fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
          {t('home.youHaveLeft')}
        </p>
        <AnimatedNumber
          value={monthBalance.leftover}
          format={(n) => formatMoney(n)}
          className="figures"
          style={{
            display: 'block',
            fontSize: 'var(--text-3xl)',
            fontWeight: 700,
            lineHeight: 'var(--lh-tight)',
            letterSpacing: '-0.022em',
            color: monthBalance.leftover >= 0 ? 'var(--text)' : 'var(--danger-text)',
          }}
        />
        <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          {t('home.explanation')}
        </p>

        {/* The four numbers that make it up. None of them can be negative. */}
        <div
          style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1,
            marginTop: 14, borderRadius: 'var(--radius-s)', overflow: 'hidden',
            background: `color-mix(in srgb, var(${heroAccentVar}) 12%, var(--line))`,
          }}
        >
          <FlowCell label={t('home.alreadyReceived')} value={flow.received} tone="positive" />
          <FlowCell label={t('home.leftToReceive')} value={flow.toReceive} tone="positive-soft" />
          <FlowCell label={t('home.alreadyPaid')} value={flow.paid} tone="plain" />
          <FlowCell label={t('home.leftToPay')} value={flow.toPay} tone="danger-soft" />
        </div>
      </div>

      {/* One box per period: two if you're paid biweekly, one if once a month. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${monthBalance.periods.length}, 1fr)`,
          gap: 10,
          marginBottom: 14,
        }}
      >
        {monthBalance.periods.map((p, i) => (
          <PeriodCard
            key={p.key}
            label={periodLabel(settings.payDays, i, month)}
            remainder={p.remainder}
            colorVar={i % 2 === 1 ? '--q25' : '--q10'}
            softVar={i % 2 === 1 ? '--q25-soft' : '--q10-soft'}
            isActive={activePeriodIdx === i}
          />
        ))}
      </div>

      {toPay.count > 0 && (
        <button
          type="button"
          onClick={() => setPorPagarOpen(true)}
          style={{
            width: '100%', background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius-m)', padding: '14px 16px', marginBottom: 20,
            cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center',
            gap: 12, color: 'var(--text)', boxShadow: 'var(--shadow-1)',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>
              Desglose de lo que falta pagar
            </div>
            <div className="figures" style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>
              {toPay.count} · {formatMoney(toPay.amount)}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', marginTop: 2 }}>
              {toPay.pending.length} {toPay.pending.length === 1 ? t('home.pending') : t('home.pendingPl')}
              {' · '}{toPay.scheduled.length} {toPay.scheduled.length === 1 ? t('home.scheduled') : t('home.scheduledPl')}
              {' · '}{toPay.onCard.length} {t('home.onCard')}
            </div>
          </div>
          <span style={{ color: 'var(--text-faint)', fontSize: 22 }}>›</span>
        </button>
      )}

      {/* Upcoming transactions FOR THE visible month: income and expenses. */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 0 10px' }}>
        <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {t('home.leftThisMonth')}
        </h2>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
          {monthName(month).toLowerCase()}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <ExpectCard label={t('home.expectToReceive')} value={totals.income} color="var(--positive)" sign="+" />
        <ExpectCard label={t('home.expectToSpend')} value={totals.expense} color="var(--danger)" sign="−" />
      </div>

      {upcoming.length === 0 ? (
        <p style={{ color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>
          {t('home.nothingPending')} — {monthName(month).toLowerCase()}.
        </p>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', overflow: 'hidden' }}>
          {upcoming.map((tx, idx) => {
            const cat = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
            const { day, month: monthLabel } = formatShortDate(relevantDate(tx));
            const isIncome = tx.type === 'income';
            const isPaid = tx.status === 'paid';
            const isLate = isCurrentMonth && relevantDate(tx) < today;
            return (
              <div
                key={tx.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderBottom: idx < upcoming.length - 1 ? '1px solid var(--line)' : 'none',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleTxPaid(tx)}
                  aria-pressed={isPaid}
                  aria-label={isIncome ? 'Marcar como recibido' : 'Marcar como pagado'}
                  style={{
                    width: 28, height: 28, minWidth: 28, borderRadius: 14, flex: 'none',
                    border: `1.5px solid ${isPaid ? 'var(--positive)' : 'var(--line-strong)'}`,
                    background: isPaid ? 'var(--positive)' : 'transparent',
                    color: isPaid ? '#fff' : 'transparent',
                    display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 14,
                    transition: 'all var(--dur-fast) var(--ease-spring-out)',
                  }}
                >
                  <IconCheck size={15} stroke={2.5} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/movimientos')}
                  style={{
                    flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none',
                    padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text)',
                  }}
                >
                  <CategoryAvatar
                    icon={cat?.icon ?? (isIncome ? 'salary' : 'other')}
                    color={cat ? categoryColor(cat) : UNCATEGORIZED_COLOR}
                    size={36}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-md)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.concept}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: isLate ? 'var(--danger-text)' : 'var(--text-muted)' }}>
                      {isLate ? `${t('home.overdue')} ` : ''}{day} {monthLabel}
                    </div>
                  </div>
                </button>
                <span
                  className="figures"
                  style={{ fontWeight: 600, fontSize: 'var(--text-md)', color: isIncome ? 'var(--positive-text)' : 'var(--text)' }}
                >
                  {isIncome ? '+ ' : ''}{formatMoney(tx.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate('/movimientos')}
        style={{ marginTop: 16, width: '100%', minHeight: 44, borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 'var(--text-base)' }}
      >
        {t('home.seeAll')}
      </button>

      {porPagarOpen && (
        <ToPaySheet toPay={toPay} onClose={() => setPorPagarOpen(false)} />
      )}
    </Screen>
  );
}

function FlowCell({ label, value, tone }: { label: string; value: number; tone: 'positive' | 'positive-soft' | 'plain' | 'danger-soft' }) {
  const color =
    tone === 'positive' ? 'var(--positive)'
    : tone === 'positive-soft' ? 'color-mix(in srgb, var(--positive) 70%, var(--text-muted))'
    : tone === 'danger-soft' ? 'color-mix(in srgb, var(--danger) 70%, var(--text-muted))'
    : 'var(--text)';
  return (
    <div style={{ background: 'var(--surface)', padding: '10px 12px' }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div className="figures" style={{ fontSize: 'var(--text-md)', fontWeight: 700, color }}>{formatMoney(value)}</div>
    </div>
  );
}

function ExpectCard({ label, value, color, sign }: { label: string; value: number; color: string; sign: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', padding: '12px 14px' }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div className="figures" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: value > 0 ? color : 'var(--text-faint)' }}>
        {value > 0 ? `${sign} ` : ''}{formatMoney(value)}
      </div>
    </div>
  );
}

/**
 * What a period is called in the box. With two or more pay days it's the
 * word the person already uses; with just one, calling it a "pay period"
 * would be a lie, so it names the month instead — or when it starts from,
 * if their month isn't the calendar one.
 */
function periodLabel(payDays: number[], index: number, month: number): string {
  if (payDays.length > 1) return `${payPeriodLabel()} ${payDays[index]}`;
  const day = payDays[0] ?? 1;
  if (day === 1) {
    const n = monthName(month);
    return n.charAt(0).toUpperCase() + n.slice(1);
  }
  return `Desde el ${day}`;
}

function PeriodCard({ label, remainder, colorVar, softVar, isActive }: {
  label: string; remainder: number; colorVar: string; softVar: string; isActive: boolean;
}) {
  return (
    <div
      style={{
        background: `var(${softVar})`,
        borderRadius: 'var(--radius-m)',
        padding: '14px 16px',
        border: isActive ? `2px solid var(${colorVar})` : '2px solid transparent',
        position: 'relative',
      }}
    >
      {isActive && (
        <span
          aria-label="Periodo activo"
          style={{
            position: 'absolute', top: 8, right: 10, width: 6, height: 6,
            borderRadius: 3, background: `var(${colorVar})`,
          }}
        />
      )}
      <p style={{ margin: '0 0 6px', fontSize: 'var(--text-xs)', fontWeight: 700, color: `var(${colorVar})`, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
        {label}
      </p>
      <p className="figures" style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700, color: remainder >= 0 ? 'var(--text)' : 'var(--danger-text)' }}>
        {formatMoney(remainder)}
      </p>
    </div>
  );
}
