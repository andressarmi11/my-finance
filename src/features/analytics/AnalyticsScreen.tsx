import { useT } from '@/i18n/language';
import { CategoryAvatar } from '@/components/ui/CategoryIcon';
import { IconChevronDown } from '@tabler/icons-react';
import { Segmented } from '@/components/ui/Segmented';
import { BigAmount } from '@/components/ui/BigAmount';
import { fill } from '@/lib/dateLabels';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { MonthNav } from '@/components/ui/MonthNav';
import { heroRangeLabel, RANGE_KEY, shortRangeLabel, widestShortRangeLabel } from './rangeLabel';
import { materializeRecurringRules } from '@/data/local/materialize';
import { useDialogo } from '@/components/ui/useDialogo';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMatch, useNavigate } from 'react-router-dom';
import { useBreakpoint } from '@/app/useBreakpoint';
import { HelpMeSaveScreen } from '@/features/savings/HelpMeSaveScreen';
import { PlanCard } from '@/features/savings/PlanCard';
import { useActivePlan } from '@/data/local/savingsPlans';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { db } from '@/data/db';
import { localRepository, DEFAULT_SETTINGS } from '@/data/local/localRepository';
import { formatMoney } from '@/domain/money/format';
import { calculateFixedVsVariable } from '@/domain/analytics/series';
import { calculateSpendByCategory } from '@/domain/totals/byCategory';
import { categoryColor, UNCATEGORIZED_COLOR } from '@/domain/seed/categoryColor';
import { filterByRange, rangeBounds, shiftAnchor, containsToday, type Range } from './periodAggregate';
import type { Transaction, Category } from '@/domain/types';
import { todayISO } from '@/lib/todayISO';
import { BudgetColumns, budgetColumns, summarizeColumns } from './BudgetColumns';
import { BudgetStats, budgetHeader } from '@/features/budgets/BudgetStats';
import { spendByMethod } from './byMethod';
import { ChartManager } from './ChartManager';
import {
  saveChartLayout, readChartLayout, readCollapsed, saveCollapsed, type ChartLayout, type ChartId,
} from './chartLayout';
import { EMPTY } from '@/lib/empty';

export function AnalyticsScreen() {
  const t = useT();
  const navigate = useNavigate();
  const desktop = useBreakpoint() === 'desktop';
  // "Ayúdame a ahorrar" lives under Análisis: over it on the phone, in its
  // place on desktop (prototype 3a).
  const planRoute = useMatch('/analisis/ahorrar') !== null;
  const activePlan = useActivePlan();
  const [range, setRange] = useState<Range>('mes');
  const [detailCategoryId, setDetailCategoryId] = useState<string | null | undefined>(undefined);
  const [layout, setLayout] = useState<ChartLayout>(readChartLayout);

  const apply = (d: ChartLayout) => { setLayout(d); saveChartLayout(d); };
  // Folded cards (§9c), remembered on this device next to the layout.
  const [collapsed, setCollapsed] = useState<ChartId[]>(readCollapsed);
  const toggleCard = (id: ChartId) => setCollapsed((prev) => {
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    saveCollapsed(next);
    return next;
  });

  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const paymentMethods = useLiveQuery(() => localRepository.listPaymentMethods(), []) ?? EMPTY;
  // Needed for 'quincena': it's the only range that isn't a calendar one.
  const settings = useLiveQuery(() => localRepository.getSettings(), []) ?? DEFAULT_SETTINGS;
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);


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
  const incomeTotal = incomeByCategory.reduce((a, c) => a + c.amount, 0);

  const fixedVsVariable = useMemo(() => calculateFixedVsVariable(rangedTransactions), [rangedTransactions]);
  const byMethod = useMemo(() => spendByMethod(rangedTransactions, paymentMethods), [rangedTransactions, paymentMethods]);

  if (planRoute && desktop) {
    // Its own header (‹ Análisis, the title): the wide screen without Screen's.
    return <div className="screen screen-wide"><HelpMeSaveScreen /></div>;
  }

  if (transactions.length === 0) {
    return (
      <Screen title={t('analytics.title')} subtitle={t('analytics.subtitle')}>
        <EmptyState title={t('analytics.noDataTitle')} body={t('analytics.noDataBody')} />
        {planRoute && <HelpMeSaveScreen />}
      </Screen>
    );
  }

  const fixedVariableTotal = fixedVsVariable.fixed + fixedVsVariable.variable;
  const methodTotal = byMethod.debit + byMethod.credit + byMethod.cash;
  const balance = incomeTotal - spendTotal;
  const pctOf = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

  // Every category + "Others", for the bar and the list.
  const categoryRows = [
    ...spendTop.map((c) => {
      const cat = c.categoryId ? categoryById.get(c.categoryId) : null;
      return {
        id: c.categoryId ?? 'none',
        name: cat?.name ?? t('analytics.noCategory'),
        icon: cat?.icon ?? 'other',
        color: cat ? categoryColor(cat) : UNCATEGORIZED_COLOR,
        amount: c.amount,
      };
    }),
    ...(spendOtherAmount > 0 ? [{ id: '__other__', name: t('analytics.others'), icon: 'other', color: 'var(--text-faint)', amount: spendOtherAmount }] : []),
  ];

  const budgetCols = budgetColumns(categories, budgets, transactions, budgetMonth);
  const budgetSummary = summarizeColumns(budgetCols);

  const methods = [
    { key: 'debit', label: t('analytics.debit'), value: byMethod.debit, color: 'var(--q10)' },
    { key: 'credit', label: t('analytics.credit'), value: byMethod.credit, color: 'var(--q25)' },
    { key: 'cash', label: t('analytics.cash'), value: byMethod.cash, color: 'var(--positive)' },
  ];
  const topMethod = methods.reduce((a, b) => (b.value > a.value ? b : a));

  // Each card, indexed by id, with the summary its folded header shows.
  // PAINTED in whatever order the user chose.
  const sections: Record<ChartId, { title: string; summary: string; content: React.ReactNode }> = {
    'spend-by-category': {
      title: t('analytics.spendByCategory'),
      summary: formatMoney(spendTotal),
      content: spendTotal > 0 ? (<>
        {/* One stacked bar, 3px apart, then one row per category. Tapping a
            row opens its detail — what the donut used to do. */}
        <div aria-hidden style={{ display: 'flex', gap: 3, height: 10, margin: '0 0 6px' }}>
          {categoryRows.map((r) => (
            <span key={r.id} style={{ width: `${(r.amount / spendTotal) * 100}%`, minWidth: 4, borderRadius: 5, background: r.color }} />
          ))}
        </div>
        {categoryRows.map((r, i) => {
          const pct = pctOf(r.amount, spendTotal);
          const disabled = r.id === '__other__';
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => !disabled && setDetailCategoryId(r.id === 'none' ? null : r.id)}
              disabled={disabled}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                background: 'none', cursor: disabled ? 'default' : 'pointer',
                textAlign: 'left', color: 'var(--text)',
              }}
            >
              <CategoryAvatar icon={r.icon} color={r.color} size={34} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 15 }}>
                  <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  <span className="figures" style={{ fontWeight: 700, flex: 'none' }}>{formatMoney(r.amount)}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <span style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', width: `${pct}%`, height: '100%', borderRadius: 3, background: r.color }} />
                  </span>
                  <span className="figures" style={{ flex: 'none', width: 30, textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>{pct}%</span>
                </span>
              </span>
            </button>
          );
        })}
      </>) : <p style={emptyNote}>{t('analytics.noData')}</p>,
    },
    'budgets': {
      title: t('analytics.monthBudgets'),
      summary: budgetHeader(t, budgetSummary),
      content: (<div style={{ marginTop: -8 }}>
        <BudgetStats summary={budgetSummary} />
        <BudgetColumns
          categories={categories}
          budgets={budgets}
          transactions={transactions}
          monthPrefix={budgetMonth}
          bleed={16}
        />
        {budgetCols.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('/ajustes/presupuestos')}
            style={{
              marginTop: 14, width: '100%', height: 40, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'var(--surface-sunken)', color: 'var(--q10-text)', fontWeight: 600, fontSize: 14,
            }}
          >
            {t('budgets.editAll')}
          </button>
        )}
      </div>),
    },
    'fixed-vs-variable': {
      title: t('analytics.fixedVsVariable'),
      summary: fixedVariableTotal > 0 ? fill(t('analytics.fixedShare'), { pct: pctOf(fixedVsVariable.fixed, fixedVariableTotal) }) : '',
      content: (
        <SplitBar
          total={fixedVariableTotal}
          parts={[
            { key: 'fixed', label: t('analytics.fixed'), value: fixedVsVariable.fixed, color: 'var(--committed)' },
            { key: 'variable', label: t('analytics.variable'), value: fixedVsVariable.variable, color: 'var(--q25)' },
          ]}
        />
      ),
    },
    'by-method': {
      title: t('analytics.byMethod'),
      summary: methodTotal > 0 ? fill(t('analytics.methodShare'), { pct: pctOf(topMethod.value, methodTotal), method: topMethod.label.toLowerCase() }) : '',
      content: <SplitBar total={methodTotal} parts={methods} />,
    },
  };

  return (
    <Screen
      title={t('analytics.title')}
      wide
      right={(
        // Beside the title, as in the prototype. Today, once you have paged
        // away, shows up to the navigator's left.
        <MonthNav
          bare
          busy={busy}
          label={shortRangeLabel(range, anchor, settings.payDays)}
          widthSample={widestShortRangeLabel(range)}
          unit="period"
          todayIsAhead={!isCurrent && anchor < today}
          onPrev={() => startTransition(() => setAnchor((a) => shiftAnchor(range, a, -1, settings.payDays)))}
          onNext={() => startTransition(() => setAnchor((a) => shiftAnchor(range, a, 1, settings.payDays)))}
          onToday={isCurrent ? undefined : () => startTransition(() => setAnchor(today))}
        />
      )}
    >
      {/* On desktop the controls keep a phone's width, centred; the cards
          below spread into a grid (§9g). */}
      <div style={{ maxWidth: 560, marginInline: 'auto' }}>
        <Segmented
          labelSize={13}
          label={t('analytics.range')}
          value={range}
          onChange={(r) => startTransition(() => setRange(r))}
          options={(['quincena', 'mes', 'trimestre', 'año'] as const).map((r) => {
            const label = t(RANGE_KEY[r]);
            return { value: r, label: label.charAt(0).toUpperCase() + label.slice(1) };
          })}
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
        {/* Hero: the one big number of the screen is the balance. */}
        <section style={{ textAlign: 'center', padding: '30px 0 26px' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 400, color: 'var(--text-muted)' }}>
            {fill(t('analytics.balanceOf'), { period: heroRangeLabel(range, anchor, settings.payDays) })}
          </h2>
          {/* The sign and the symbol carry the colour; the figure stays in
              text colour (prototype 1a). */}
          <BigAmount
            value={balance}
            size={50}
            signed
            accent={balance >= 0 ? 'var(--positive-text)' : 'var(--danger-text)'}
          />
          <p
            className="figures"
            style={{ margin: '12px 0 0', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '4px 12px', fontSize: 13, color: 'var(--text-muted)' }}
          >
            <span style={{ whiteSpace: 'nowrap' }}>{t('filter.income')} <b style={{ color: 'var(--positive-text)' }}>{formatMoney(incomeTotal)}</b></span>
            <span style={{ whiteSpace: 'nowrap' }}>{t('filter.expenses')} <b style={{ color: 'var(--text)' }}>{formatMoney(spendTotal)}</b></span>
          </p>
        </section>

        {desktop ? (
          // Prototype 3a: the plan beside the budgets, above the other cards.
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.25fr) minmax(0,1fr)', gap: 20, marginBottom: 20, alignItems: 'start' }}>
            <PlanCard range={range} from={rangeFrom} to={rangeTo} desktop />
            <section aria-label={t('budgets.title')} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <h2 style={{ margin: 0, fontWeight: 700, fontSize: 17 }}>{t('budgets.title')}</h2>
                <button
                  type="button"
                  onClick={() => navigate('/analisis/ahorrar')}
                  style={{ border: 'none', background: 'none', color: 'var(--positive-text)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }}
                >
                  {t(activePlan ? 'save.adjustMine' : 'save.buildWith')}
                </button>
              </div>
              {(budgetSummary.spending || budgetSummary.savings) && <div style={{ marginTop: 12 }}><BudgetStats summary={budgetSummary} size={15} /></div>}
              <BudgetColumns categories={categories} budgets={budgets} transactions={transactions} monthPrefix={budgetMonth} width={80} />
            </section>
          </div>
        ) : (
          <PlanCard range={range} from={rangeFrom} to={rangeTo} />
        )}

        <div className="analytics-grid">
        {layout.order
          // On desktop the budgets sit beside the plan, above.
          .filter((id) => !layout.hiddenIds.includes(id) && !(desktop && id === 'budgets'))
          .map((id) => (
            <ChartCard
              key={id}
              title={sections[id].title}
              summary={sections[id].summary}
              collapsed={collapsed.includes(id)}
              onToggle={() => toggleCard(id)}
            >
              {sections[id].content}
            </ChartCard>
          ))}
        </div>
      </div>

      {planRoute && <HelpMeSaveScreen />}

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

/**
 * A foldable card (§9c): the header is a button with the title, a summary
 * on the right ("$ 6.559.000", "89% usado") and a chevron that rotates.
 */
function ChartCard({ title, summary, collapsed, onToggle, children }: {
  title: string; summary: string; collapsed: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  const t = useT();
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', marginBottom: 12, overflow: 'hidden' }}>
      <h2 style={{ margin: 0 }}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={fill(t('analytics.toggleCard'), { title })}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 16,
            border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text)', textAlign: 'left',
          }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700 }}>{title}</span>
          {summary && (
            <span className="figures" style={{ flex: 'none', fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>{summary}</span>
          )}
          <IconChevronDown
            size={18}
            stroke={2}
            aria-hidden
            style={{ flex: 'none', color: 'var(--text-faint)', transform: collapsed ? 'none' : 'rotate(180deg)', transition: 'transform var(--dur-fast) var(--ease-spring-out)' }}
          />
        </button>
      </h2>
      {!collapsed && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </section>
  );
}

/** A bar split in parts (8px), with the legend underneath. */
function SplitBar({ total, parts }: { total: number; parts: Array<{ key: string; label: string; value: number; color: string }> }) {
  if (total <= 0) return <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-sunken)' }} />;
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div>
      <div aria-hidden style={{ display: 'flex', gap: 3, height: 8, marginBottom: 8 }}>
        {shown.map((p) => (
          <span key={p.key} style={{ width: `${(p.value / total) * 100}%`, minWidth: 4, borderRadius: 4, background: p.color }} />
        ))}
      </div>
      {/* Prototype 1a: "Fijos · $ 5.716.900", spread across the width. */}
      <div className="figures" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
        {parts.map((p) => (
          <span key={p.key}>{p.label} · {formatMoney(p.value)}</span>
        ))}
      </div>
    </div>
  );
}


const emptyNote: React.CSSProperties = { margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-faint)' };

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
          borderRadius: '28px 28px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)',
          maxHeight: '80vh', overflowY: 'auto',
          animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
        }}
      >
        <div style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--handle)', margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <CategoryAvatar
            icon={category?.icon ?? 'other'}
            color={category ? categoryColor(category) : UNCATEGORIZED_COLOR}
            size={44}
          />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>{category?.name ?? t('analytics.noCategory')}</h2>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {transactions.length} {transactions.length === 1 ? t('transactions.transaction') : t('transactions.transactionsPl')}
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          <StatBox label={t('analytics.total')} value={formatMoney(total)} />
          <StatBox label={t('analytics.percentOfSpend')} value={`${pct}%`} />
          <StatBox label={t('analytics.average')} value={formatMoney(avg)} />
        </div>

        {transactions.length > 0 ? (
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('transactions.title')}</h3>
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
          {t('action.close')}
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


