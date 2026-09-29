import { useT } from '@/i18n/language';
import { CategoryAvatar, CategoryIcon } from '@/components/ui/CategoryIcon';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { MonthNav } from '@/components/ui/MonthNav';
import { describeRange, RANGE_KEY, widestRangeLabel } from './rangeLabel';
import { materializeRecurringRules } from '@/data/local/materialize';
import { useDialogo } from '@/components/ui/useDialogo';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { db } from '@/data/db';
import { localRepository, DEFAULT_SETTINGS } from '@/data/local/localRepository';
import { formatCompact, formatMoney } from '@/domain/money/format';
import { calculateDebitVsCredit, calculateFixedVsVariable, monthlySeries } from '@/domain/analytics/series';
import { calculateSpendByCategory } from '@/domain/totals/byCategory';
import { categoryColor, UNCATEGORIZED_COLOR } from '@/domain/seed/categoryColor';
import { filterByRange, untilToday, rangeBounds, fillGaps, toMonthlyPoints, toQuarterlyPoints, toYearlyPoints, shiftAnchor, containsToday, type PeriodPoint, type Range } from './periodAggregate';
import type { Transaction, Category } from '@/domain/types';
import { todayISO } from '@/lib/todayISO';
import { BudgetColumns } from './BudgetColumns';
import { ChartManager } from './ChartManager';
import {
  saveChartLayout, readChartLayout, type ChartLayout, type ChartId,
} from './chartLayout';
import { EMPTY } from '@/lib/empty';

const CHART_COLORS = ['#007AFF', '#FF9500', '#34C759', '#AF52DE', '#FF3B30', '#FFCC00', '#5AC8FA', '#FF2D55'];

export function AnalyticsScreen() {
  const t = useT();
  const [range, setRange] = useState<Range>('mes');
  const [detailCategoryId, setDetailCategoryId] = useState<string | null | undefined>(undefined);
  const [layout, setLayout] = useState<ChartLayout>(readChartLayout);

  const apply = (d: ChartLayout) => { setLayout(d); saveChartLayout(d); };

  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const paymentMethods = useLiveQuery(() => localRepository.listPaymentMethods(), []) ?? EMPTY;
  // Needed for 'quincena': it's the only range that isn't a calendar one.
  const settings = useLiveQuery(() => localRepository.getSettings(), []) ?? DEFAULT_SETTINGS;
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const creditMethodIds = useMemo(
    () => new Set(paymentMethods.filter((m) => m.type === 'credit').map((m) => m.id)),
    [paymentMethods],
  );

  // "Historical" means up to today: the future is cut off and any empty
  // months left in between are filled in, so the axis doesn't lie about how
  // much time passed between one bar and the next.
  const monthly = useMemo(
    () => fillGaps(untilToday(monthlySeries(transactions), todayISO())),
    [transactions],
  );
  const points: PeriodPoint[] = useMemo(() => {
    // The historical series is monthly; on the biweekly range the same
    // months are shown. Without this case, 'quincena' fell through to the
    // `return` below and drew the YEARLY series next to a title reading
    // "25 sep - 9 oct".
    if (range === 'quincena' || range === 'mes') return toMonthlyPoints(monthly).slice(-6);
    if (range === 'trimestre') return toQuarterlyPoints(monthly).slice(-4);
    return toYearlyPoints(monthly);
  }, [monthly, range]);

  // Filter transactions by the selected range — ALL the cards
  // (balance, pie, fijos/variables, débito/tarjeta) usan este filtro.
  const today = todayISO();
  // The day the range is built around. Starts today; the arrows move it a
  // whole range at a time, so last month's split or next quarter's plan is
  // one tap away. Switching Month → Quarter keeps it: the quarter shown is
  // the one containing the month you were on.
  const [anchor, setAnchor] = useState(today);
  const isCurrent = containsToday(range, anchor, today, settings.payDays);
  const { from: rangeFrom, to: rangeTo } = rangeBounds(range, anchor, settings.payDays);
  // Budgets are monthly. On the current range, this month's; paged away,
  // the month the range starts in. ONE value feeds both the budgets and the
  // spending they're measured against — they used to come from different
  // months, so paging showed August's budgets against September's spend.
  const budgetMonth = (isCurrent ? today : rangeFrom).slice(0, 7);
  const budgets = useLiveQuery(
    () => localRepository.listBudgets(Number(budgetMonth.slice(0, 4)), Number(budgetMonth.slice(5, 7))),
    [budgetMonth],
  ) ?? EMPTY;
  const rangedTransactions = useMemo(
    () => filterByRange(transactions, range, anchor, settings.payDays),
    [transactions, range, anchor, settings.payDays],
  );
  // Not memoised: it reads the active language's month names, and a memo
  // keyed on the dates alone kept the old language after switching.
  const rangeLabel = describeRange(range, anchor, settings.payDays);

  // A future range needs its recurring payments to exist to be a forecast.
  // One pass over the whole range (materialize reads the table once), not
  // one per month; it only adds what's missing, so paging back is free.
  // How far ahead it will generate is capped inside materialize itself.
  //
  // Paging used to just freeze for a moment while this and the charts
  // caught up, with nothing on screen to say why. Now the screen is "busy"
  // until the period is really ready, and the arrows wait for it:
  //   * React is still rendering the new period (the transition), or
  //   * this generation hasn't finished — and when it wrote new rows, until
  //     those rows have come back through the live query into `transactions`.
  // Derived during render rather than set in an effect: `ready` is written
  // only from the async callback, never synchronously in an effect.
  const rangeKey = `${rangeFrom}|${rangeTo}`;
  // Ranges already generated this visit: paging back to one is not "busy".
  const [readyKeys, setReadyKeys] = useState<ReadonlySet<string>>(() => new Set());
  // A range whose generation wrote rows: it stays busy until `transactions`
  // is no longer the array that was current BEFORE the write — so an update
  // that lands before the promise resolves still counts as arrived.
  const [arriving, setArriving] = useState<{ key: string; before: readonly Transaction[] } | null>(null);
  const latestTransactions = useRef(transactions);
  useEffect(() => { latestTransactions.current = transactions; }, [transactions]);
  useEffect(() => {
    let cancelled = false;
    const before = latestTransactions.current;
    const markReady = () => {
      if (!cancelled) setReadyKeys((keys) => (keys.has(rangeKey) ? keys : new Set(keys).add(rangeKey)));
    };
    // Hard ceiling: whatever happens below, the arrows come back.
    const ceiling = setTimeout(markReady, 2500);
    materializeRecurringRules({ from: rangeFrom, to: rangeTo })
      .then((fresh) => {
        if (cancelled) return;
        if (fresh > 0) setArriving({ key: rangeKey, before });
        markReady();
      })
      .catch((e: unknown) => {
        // Not worth interrupting anyone: the range just shows without its
        // forecast, and the next visit tries again.
        console.warn('Analytics: could not generate recurring payments for the range', e);
        markReady();
      });
    return () => { cancelled = true; clearTimeout(ceiling); };
  }, [rangeFrom, rangeTo, rangeKey]);
  const [isRendering, startTransition] = useTransition();
  const stillArriving = arriving?.key === rangeKey && arriving.before === transactions;
  const busy = isRendering || !readyKeys.has(rangeKey) || stillArriving;
  // Inert while busy: pointer-events alone left the dimmed charts reachable
  // by keyboard. React 18 has no `inert` prop, so it's set on the element.
  const chartsRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chartsRef.current?.toggleAttribute('inert', busy); }, [busy]);

  // Spend by category (top N + "Others")
  const spendByCategory = useMemo(() => calculateSpendByCategory(rangedTransactions), [rangedTransactions]);
  const spendTop = spendByCategory.slice(0, 7);
  const spendOtherAmount = spendByCategory.slice(7).reduce((a, c) => a + c.amount, 0);
  const spendTotal = spendByCategory.reduce((a, c) => a + c.amount, 0);

  // Income by category (new — until now it was only expenses)
  const incomeByCategory = useMemo(() => calculateIncomeByCategory(rangedTransactions), [rangedTransactions]);
  const incomeTop = incomeByCategory.slice(0, 5);
  const incomeTotal = incomeByCategory.reduce((a, c) => a + c.amount, 0);

  const fixedVsVariable = useMemo(() => calculateFixedVsVariable(rangedTransactions), [rangedTransactions]);
  const debitVsCredit = useMemo(() => calculateDebitVsCredit(rangedTransactions, creditMethodIds), [rangedTransactions, creditMethodIds]);

  if (transactions.length === 0) {
    return (
      <Screen title={t('analytics.title')} subtitle={t('analytics.subtitle')}>
        <EmptyState title={t('analytics.noDataTitle')} body={t('analytics.noDataBody')} />
      </Screen>
    );
  }

  const fixedVariableTotal = fixedVsVariable.fixed + fixedVsVariable.variable;
  const debitCreditTotal = debitVsCredit.debit + debitVsCredit.credit;

  // Pie data (every category + "Others")
  const pieData = [
    ...spendTop.map((c) => {
      const cat = c.categoryId ? categoryById.get(c.categoryId) : null;
      return {
        id: c.categoryId ?? 'none',
        name: cat?.name ?? t('analytics.noCategory'),
        icon: cat?.icon ?? 'other',
        color: cat ? categoryColor(cat) : UNCATEGORIZED_COLOR,
        amount: c.amount,
        count: c.count,
      };
    }),
    ...(spendOtherAmount > 0 ? [{ id: '__other__', name: t('analytics.others'), icon: '⋯', color: 'var(--text-faint)', amount: spendOtherAmount, count: spendByCategory.slice(7).reduce((a, c) => a + c.count, 0) }] : []),
  ];

  // Each chart, indexed by id. Built here and PAINTED in whatever order
  // the user chose, instead of being hard-wired into the JSX.
  const sections: Record<ChartId, { title: string; content: React.ReactNode }> = {
    'balance-by-category': { title: t('analytics.balanceByCategory'), content: (<>
        <StackedBar
          label={t('filter.income')}
          total={incomeTotal}
          segments={incomeTop.map((c, i) => {
            const cat = c.categoryId ? categoryById.get(c.categoryId) : null;
            return {
              id: c.categoryId ?? `income-${i}`,
              name: cat?.name ?? t('analytics.noCategory'),
              icon: cat?.icon ?? 'other',
              color: cat ? categoryColor(cat) : CHART_COLORS[i % CHART_COLORS.length]!,
              amount: c.amount,
            };
          })}
          amountColor="var(--positive)"
          prefix="+ "
        />
        <div style={{ height: 12 }} />
        <StackedBar
          label={t('filter.expenses')}
          total={spendTotal}
          segments={spendTop.map((c, i) => {
            const cat = c.categoryId ? categoryById.get(c.categoryId) : null;
            return {
              id: c.categoryId ?? `spend-${i}`,
              name: cat?.name ?? t('analytics.noCategory'),
              icon: cat?.icon ?? 'other',
              color: cat ? categoryColor(cat) : CHART_COLORS[i % CHART_COLORS.length]!,
              amount: c.amount,
            };
          })}
          amountColor="var(--text)"
        />
        <div style={{ height: 12 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>{t('analytics.balance')}</span>
          <span className="figures" style={{ fontWeight: 700, color: incomeTotal - spendTotal >= 0 ? 'var(--positive-text)' : 'var(--danger-text)' }}>
            {incomeTotal - spendTotal >= 0 ? '+ ' : ''}{formatMoney(incomeTotal - spendTotal)}
          </span>
        </div>
    </>) },
    'distribution': { title: t('analytics.distribution'), content: (<>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="amount"
                nameKey="id"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={2}
                onClick={(entry) => {
                  const id = (entry as unknown as { id?: string })?.id;
                  if (typeof id === 'string' && id !== '__other__') {
                    setDetailCategoryId(id === 'none' ? null : id);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.id} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatMoney(typeof v === 'number' ? v : Number(v ?? 0))} contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ flex: 1, minWidth: 0 }}>
            {pieData.map((entry) => {
              const pct = spendTotal > 0 ? Math.round((entry.amount / spendTotal) * 100) : 0;
              const disabled = entry.id === '__other__';
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => !disabled && setDetailCategoryId(entry.id === 'none' ? null : entry.id)}
                  disabled={disabled}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '4px 6px', marginBottom: 2, border: 'none', background: 'transparent',
                    cursor: disabled ? 'default' : 'pointer', textAlign: 'left', color: 'var(--text)',
                    borderRadius: 6, fontSize: 'var(--text-sm)',
                  }}
                >
                  <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <CategoryIcon icon={entry.icon} size={15} color={entry.color} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                  </span>
                  <span className="figures" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{pct}%</span>
                </button>
              );
            })}
          </div>
        </div>
        <p style={{ margin: '10px 4px 0', fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}>
          {t('analytics.tapCategory')}
        </p>
    </>) },
    'income-vs-expenses': { title: t('analytics.incomeVsExpenses'), content: (<>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={points} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-faint)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCompact(v)} width={44} />
            <Tooltip formatter={(v) => formatMoney(typeof v === 'number' ? v : Number(v ?? 0))} contentStyle={tooltipStyle} />
            <Bar dataKey="income" name="Ingresos" fill="var(--positive)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="Gastos" fill="var(--danger)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
    </>) },
    'fixed-vs-variable': { title: t('analytics.fixedVsVariable'), content: (<>
        <SplitBar
          a={{ label: 'Fijos', value: fixedVsVariable.fixed, color: 'var(--committed)' }}
          b={{ label: 'Variables', value: fixedVsVariable.variable, color: 'var(--q25-text)' }}
          total={fixedVariableTotal}
        />
    </>) },
    'debit-vs-credit': { title: t('analytics.debitVsCredit'), content: (<>
        <SplitBar
          a={{ label: 'Débito', value: debitVsCredit.debit, color: 'var(--q10-text)' }}
          b={{ label: 'Tarjeta', value: debitVsCredit.credit, color: 'var(--q25-text)' }}
          total={debitCreditTotal}
        />
    </>) },
    'budgets': {
      title: t('analytics.monthBudgets'),
      content: (
        <BudgetColumns
          categories={categories}
          budgets={budgets}
          transactions={transactions}
          monthPrefix={budgetMonth}
        />
      ),
    },
  };

  return (
    <Screen title={t('analytics.title')}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {(['quincena', 'mes', 'trimestre', 'año'] as const).map((r) => (
          <button
            key={r} type="button" onClick={() => startTransition(() => setRange(r))} aria-pressed={range === r}
            style={{
              flex: 1, minHeight: 'var(--tap)', borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
              background: range === r ? 'var(--q10)' : 'var(--surface)', color: range === r ? '#fff' : 'var(--text)',
              fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', fontSize: 'var(--text-sm)',
              transition: 'all var(--dur-fast) var(--ease-spring-out)',
            }}
          >
            {t(RANGE_KEY[r])}
          </button>
        ))}
      </div>

      {/* Its own row, centred: "Octubre – Diciembre 2026" doesn't fit beside
          the title on a phone. Today sits on the side you paged towards. */}
      <div style={{ marginBottom: 20 }}>
        <MonthNav
          centered
          busy={busy}
          label={rangeLabel}
          widthSample={widestRangeLabel(range)}
          unit="period"
          todayIsAhead={!isCurrent && anchor < today}
          onPrev={() => startTransition(() => setAnchor((a) => shiftAnchor(range, a, -1, settings.payDays)))}
          onNext={() => startTransition(() => setAnchor((a) => shiftAnchor(range, a, 1, settings.payDays)))}
          onToday={isCurrent ? undefined : () => startTransition(() => setAnchor(today))}
        />
      </div>

      {/* Dimmed and inert while the period loads: the numbers on screen
          belong to the period you're leaving. */}
      <div
        ref={chartsRef}
        aria-busy={busy}
        style={{
          opacity: busy ? 0.45 : 1,
          pointerEvents: busy ? 'none' : undefined,
          // Dims only if loading actually takes a moment: a quick period
          // swap shows no flash. Brightening back is immediate.
          transition: busy ? 'opacity 150ms ease 150ms' : 'opacity 100ms ease',
        }}
      >
        {layout.order
          .filter((id) => !layout.hiddenIds.includes(id))
          .map((id) => (
            <ChartCard key={id} title={sections[id].title}>
              {sections[id].content}
            </ChartCard>
          ))}
      </div>

      <ChartManager
        layout={layout}
        titles={Object.fromEntries(
          (Object.keys(sections) as ChartId[]).map((id) => [id, sections[id].title]),
        ) as Record<ChartId, string>}
        onChange={apply}
      />

      {detailCategoryId !== undefined && (
        <CategoryDetailSheet
          categoryId={detailCategoryId}
          category={detailCategoryId ? categoryById.get(detailCategoryId) : null}
          transactions={rangedTransactions.filter((t) => t.type === 'expense' && t.status !== 'cancelled' && t.categoryId === detailCategoryId)}
          totalSpend={spendTotal}
          onClose={() => setDetailCategoryId(undefined)}
        />
      )}
    </Screen>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', padding: '14px 14px 12px', marginBottom: 14, boxShadow: 'var(--shadow-1)' }}>
      <h2 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, margin: '0 0 12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{title}</h2>
      {children}
    </div>
  );
}

function StackedBar({ label, total, segments, amountColor, prefix }: {
  label: string;
  total: number;
  segments: Array<{ id: string; name: string; color: string; amount: number; icon?: string }>;
  amountColor: string;
  prefix?: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
        <span className="figures" style={{ fontWeight: 700, color: amountColor }}>
          {prefix ?? ''}{formatMoney(total)}
        </span>
      </div>
      {total > 0 ? (
        <div style={{ display: 'flex', height: 20, borderRadius: 6, overflow: 'hidden', gap: 1 }}>
          {segments.map((s) => (
            <div
              key={s.id}
              title={`${s.name}: ${formatMoney(s.amount)}`}
              style={{ width: `${(s.amount / total) * 100}%`, background: s.color, minWidth: 3 }}
            />
          ))}
        </div>
      ) : (
        <div style={{ height: 20, borderRadius: 6, background: 'var(--surface-sunken)' }} />
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {segments.map((s) => (
          <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {/* The icon already carries the category's colour, so a colour
                dot would be saying the same thing twice. */}
            <CategoryIcon icon={s.icon} size={14} color={s.color} />
            {s.name} · <span className="figures">{Math.round((s.amount / (total || 1)) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SplitBar({ a, b, total }: { a: { label: string; value: number; color: string }; b: { label: string; value: number; color: string }; total: number }) {
  const pctA = total > 0 ? (a.value / total) * 100 : 50;
  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ width: `${pctA}%`, background: a.color }} />
        <div style={{ width: `${100 - pctA}%`, background: b.color }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
        <span><Dot color={a.color} /> {a.label} · <span className="figures">{formatMoney(a.value)}</span></span>
        <span><Dot color={b.color} /> {b.label} · <span className="figures">{formatMoney(b.value)}</span></span>
      </div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span aria-hidden style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: color, marginRight: 4 }} />;
}

function CategoryDetailSheet({
  category, transactions, totalSpend, onClose,
}: {
  categoryId: string | null;
  category: Category | null | undefined;
  transactions: Transaction[];
  totalSpend: number;
  onClose: () => void;
}) {
  const total = transactions.reduce((a, t) => a + t.amount, 0);
  const pct = totalSpend > 0 ? Math.round((total / totalSpend) * 100) : 0;
  const avg = transactions.length ? Math.round(total / transactions.length) : 0;

  const t = useT();
  const dialogRef = useDialogo(onClose);
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={category?.name ?? t('analytics.categoryDetail')}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)',
        display: 'flex', alignItems: 'flex-end', zIndex: 60,
        animation: 'fadeIn var(--dur-fast) var(--ease-spring-out)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)',
          borderRadius: '20px 20px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)',
          maxHeight: '80vh', overflowY: 'auto',
          animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <CategoryAvatar
            icon={category?.icon ?? 'other'}
            color={category ? categoryColor(category) : UNCATEGORIZED_COLOR}
            size={44}
          />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>{category?.name ?? t('analytics.noCategory')}</h2>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {transactions.length} movimiento{transactions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          <StatBox label="Total" value={formatMoney(total)} />
          <StatBox label="{t('analytics.percentOfSpend')}" value={`${pct}%`} />
          <StatBox label="Promedio" value={formatMoney(avg)} />
        </div>

        {transactions.length > 0 ? (
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Movimientos</h3>
            {transactions.slice(0, 20).map((tx, idx) => (
              <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', borderBottom: idx < Math.min(20, transactions.length) - 1 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-md)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.concept}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{tx.date}</div>
                </div>
                <span className="figures" style={{ fontWeight: 600 }}>{formatMoney(tx.amount)}</span>
              </div>
            ))}
            {transactions.length > 20 && (
              <p style={{ margin: '10px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-faint)', textAlign: 'center' }}>
                {t('analytics.andNMore').replace('{n}', String(transactions.length - 20))}
              </p>
            )}
          </div>
        ) : (
          <p style={{ color: 'var(--text-faint)' }}>{t('analytics.noTransactionsInCategory')}</p>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%', marginTop: 16, minHeight: 44, borderRadius: 'var(--radius-s)',
            border: 'none', background: 'var(--surface-sunken)', color: 'var(--text)',
            fontWeight: 600, fontSize: 'var(--text-base)', cursor: 'pointer',
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--radius-s)', padding: '10px 12px' }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div className="figures" style={{ fontSize: 'var(--text-md)', fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function calculateIncomeByCategory(transactions: Transaction[]): Array<{ categoryId: string | null; amount: number; count: number }> {
  const map = new Map<string | null, { categoryId: string | null; amount: number; count: number }>();
  for (const tx of transactions) {
    if (tx.type !== 'income' || tx.status === 'cancelled') continue;
    const current = map.get(tx.categoryId) ?? { categoryId: tx.categoryId, amount: 0, count: 0 };
    current.amount += tx.amount;
    current.count += 1;
    map.set(tx.categoryId, current);
  }
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

const tooltipStyle: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 'var(--text-sm)',
};

