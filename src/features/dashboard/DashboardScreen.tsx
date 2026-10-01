import { useLanguage } from '@/i18n/language';
import { monthFromLabel, payPeriodLabel } from '@/i18n/periodLabels';
import { fill } from '@/lib/dateLabels';
import { Logo } from '@/components/ui/Logo';
import { BigAmount } from '@/components/ui/BigAmount';
import { IconCheck, IconCreditCardOff } from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
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
import { calculatePeriod, periodMonthOf, periodsOfMonth } from '@/domain/period/period';
import { withResolvedPeriods } from '@/domain/period/resolve';
import { shiftMonth } from '@/domain/dates';
import { shortDay } from '@/lib/formatShortDate';
import { todayISO, nowISO } from '@/lib/todayISO';
import { selectUpcoming, relevantDate } from './upcoming';
import { ToPaySheet } from './ToPaySheet';
import { haptic } from '@/lib/haptic';
import type { Transaction } from '@/domain/types';
import { EMPTY } from '@/lib/empty';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { useBreakpoint } from '@/app/useBreakpoint';
import { SEARCH_INPUT_ID, consumeSearchFocus, onSearchFocusRequest } from '@/app/searchFocus';
import { QuickActions } from '@/components/ui/TabBar';
import { BudgetColumns } from '@/features/analytics/BudgetColumns';
import { TransactionsScreen } from '@/features/transactions/TransactionsScreen';
import { InboxButton } from '@/features/inbox/InboxButton';
import { InboxCard } from '@/features/inbox/InboxCard';
import { ArrivedAloneMark } from '@/features/transactions/TransactionRow';


export function DashboardScreen() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [porPagarOpen, setPorPagarOpen] = useState(false);

  const today = todayISO();
  const settings = useLiveQuery(() => localRepository.getSettings(), []) ?? DEFAULT_SETTINGS;
  // The month of today's PERIOD (periodMonthOf): paid on the 10th/25th,
  // October 1st–9th are still September's last period.
  const { y: todayYear, m: todayMonth } = periodMonthOf(today, settings.payDays);

  // Visible month. Starts on the current one; the arrows move it.
  // Everything below (flow, pay periods, upcoming) is recalculated for
  // THIS month. null = follow "today" (settings load after the first render).
  const [ownCursor, setOwnCursor] = useState<{ y: number; m: number } | null>(null);
  const cursor = ownCursor ?? { y: todayYear, m: todayMonth };
  const setCursor = (next: { y: number; m: number } | ((c: { y: number; m: number }) => { y: number; m: number })) =>
    setOwnCursor((c) => (typeof next === 'function' ? next(c ?? { y: todayYear, m: todayMonth }) : next));
  const { y: year, m: month } = cursor;
  const isCurrentMonth = year === todayYear && month === todayMonth;

  // Recurring transactions are only materialized ~3 months ahead. Looking
  // at a month outside that window means they have to be created, or the
  // month comes out empty even though the rule has no end date.
  useEffect(() => { void ensureMonthMaterialized(year, month); }, [year, month]);

  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? EMPTY;
  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const paymentMethods = useLiveQuery(() => localRepository.listPaymentMethods(), []) ?? EMPTY;
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Desktop (§9g): two columns, with Movimientos embedded as a table on the
  // right. The header's search box feeds it; ⌘K focuses the box.
  const desktop = useBreakpoint() === 'desktop';
  const [query, setQuery] = useState('');
  const [quickOpen, setQuickOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const budgets = useLiveQuery(
    () => (desktop ? localRepository.listBudgets(year, month) : Promise.resolve([])),
    [desktop, year, month],
  ) ?? EMPTY;
  const hasTransactions = transactions.length > 0;
  useEffect(() => {
    if (!desktop) return;
    const focus = () => { searchRef.current?.focus(); searchRef.current?.select(); };
    if (consumeSearchFocus()) focus();
    return onSearchFocusRequest(() => { consumeSearchFocus(); focus(); });
  }, [desktop]);

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
  // The period the context line talks about: today's, or the month's first
  // one when you're looking at another month.
  const linePeriodIdx = activePeriodIdx >= 0 ? activePeriodIdx : 0;
  const linePeriod = monthBalance.periods[linePeriodIdx];
  const lineColorVar = linePeriodIdx % 2 === 1 ? '--q25-text' : '--q10-text';

  // "septiembre" inside a Spanish sentence, "September" in English.
  // Capitalised in both languages, as the prototype writes it (§3).
  const monthInSentence = monthName(month);
  const heroLine = settings.displayName
    ? fill(t('home.heroLine'), { name: settings.displayName, month: monthInSentence })
    : fill(t('home.heroLineNoName'), { month: monthInSentence });

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
      compact
      large={desktop}
      label={`${monthName(month).slice(0, 3)} ${year}`}
      widthSample={widestMonthLabel(true)}
      todayIsAhead={year * 12 + month < todayYear * 12 + todayMonth}
      onPrev={() => setCursor((c) => shiftMonth(c.y, c.m, -1))}
      onNext={() => setCursor((c) => shiftMonth(c.y, c.m, 1))}
      onToday={isCurrentMonth ? undefined : () => setCursor({ y: todayYear, m: todayMonth })}
      beforePill={desktop ? undefined : <InboxButton />}
    />
  );

  // Inicio's own header (§3): the brand on the left and the month on the
  // right. It replaces the global brand bar; the other screens are
  // oriented by their large title.
  const header = (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, height: 44 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Logo size={22} />
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.015em', whiteSpace: 'nowrap' }}>
          Step up
        </span>
      </span>
      {transactions.length > 0 ? nav : <InboxButton />}
    </header>
  );

  // The same empty state as the phone; on desktop it goes in the left column,
  // beside an (empty) Movimientos, so the header's actions stay reachable.
  const emptyHome = (
    <EmptyState
      title={t('home.noTransactions')}
      body={t('home.noTransactionsBody')}
      action={{ label: loadingDemo ? t('home.loading') : t('home.loadSample'), onClick: handleLoadDemo }}
    />
  );

  if (transactions.length === 0 && !desktop) {
    return (
      <HomeFrame>
        {header}
        <h1 style={{ margin: '0 0 16px', fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em' }}>
          {settings.displayName ? `${t('home.hello')}, ${settings.displayName}` : t('home.title')}
        </h1>
        <InboxCard style={{ marginBottom: 16 }} />
        {emptyHome}
      </HomeFrame>
    );
  }

  // Only if there is something to warn about. Everything being up to date
  // is not news — same rule as SyncIndicator.
  const overdueBanner = overdue.length > 0 && (
    <button
      type="button"
      onClick={() => navigate('/tarjeta')}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--danger-soft)',
        border: '1px solid color-mix(in srgb, var(--danger) 30%, var(--line))',
        borderRadius: 'var(--radius-m)', padding: '12px 14px', marginBottom: desktop ? 0 : 16,
        color: 'var(--text)',
      }}
    >
      <IconCreditCardOff size={22} stroke={1.75} aria-hidden style={{ flex: 'none' }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--danger-text)' }}>
          {overdue.length === 1 ? t('home.unpaidBalance') : `${overdue.length} ${t('home.unpaidBalances')}`}
        </span>
        <span style={{ display: 'block', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          {overdue.length === 1
            ? `${overdue[0]!.card.name} · ${t('home.overdueOn')} ${shortDay(overdue[0]!.paymentDate)}`
            : t('home.markThem')}
        </span>
      </span>
      <span className="figures" style={{ flex: 'none', fontWeight: 700, color: 'var(--danger-text)' }}>
        {formatMoney(overdue.reduce((a, v) => a + v.total, 0))}
      </span>
    </button>
  );

  const periodLine = linePeriod && (
    <p style={{ margin: desktop ? '12px 0 0' : '14px 0 0', display: 'flex', alignItems: 'center', justifyContent: desktop ? 'flex-start' : 'center', gap: 7, fontSize: 14 }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: `var(${lineColorVar})` }} />
      <span style={{ color: `var(${lineColorVar})`, fontWeight: 600 }}>
        {periodLabel(settings.payDays, linePeriodIdx, month)}
      </span>
      <span className="figures" style={{ color: 'var(--text-muted)' }}>
        · {fill(t('home.periodLeft'), { amount: formatMoney(linePeriod.remainder) })}
      </span>
    </p>
  );

  // The four numbers that make it up, in one card. None can be negative.
  // "Falta pagar" opens its breakdown.
  const flowGrid = (
    <div
      style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1,
        borderRadius: desktop ? 16 : 'var(--radius-card)', overflow: 'hidden',
        background: 'var(--line)', border: desktop ? 'none' : '1px solid var(--line)',
        marginTop: desktop ? 20 : 0,
      }}
    >
      <FlowCell label={t('home.alreadyReceived')} value={flow.received} tone="positive" inset={desktop} />
      <FlowCell label={t('home.leftToReceive')} value={flow.toReceive} tone="positive" inset={desktop} />
      <FlowCell label={t('home.alreadyPaid')} value={flow.paid} tone="plain" inset={desktop} />
      <FlowCell
        label={t('home.leftToPay')}
        value={flow.toPay}
        tone="danger"
        inset={desktop}
        onClick={toPay.count > 0 ? () => setPorPagarOpen(true) : undefined}
      />
    </div>
  );

  // Upcoming transactions FOR THE visible month: income and expenses.
  const upcomingList = upcoming.length === 0 ? (
    <p style={{ color: 'var(--text-faint)', fontSize: 'var(--text-sm)' }}>
      {t('home.nothingPending')} — {monthName(month).toLowerCase()}.
    </p>
  ) : (
    <div style={desktop ? {} : { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
      {upcoming.map((tx, idx) => {
        const cat = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
        const isIncome = tx.type === 'income';
        const isPaid = tx.status === 'paid';
        const isLate = isCurrentMonth && relevantDate(tx) < today;
        return (
          <div
            key={tx.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: desktop ? '10px 0' : '12px 14px',
              borderBottom: idx < upcoming.length - 1 ? '1px solid var(--line)' : 'none',
            }}
          >
            <button
              type="button"
              onClick={() => toggleTxPaid(tx)}
              aria-pressed={isPaid}
              aria-label={isIncome ? t('home.markAsReceived') : t('home.markAsPaid')}
              style={{
                width: desktop ? 24 : 26, height: desktop ? 24 : 26, minWidth: desktop ? 24 : 26, borderRadius: 13, flex: 'none',
                border: `1.5px solid ${isPaid ? 'var(--positive)' : 'var(--line-strong)'}`,
                background: isPaid ? 'var(--positive)' : 'transparent',
                color: isPaid ? 'var(--on-accent)' : 'transparent',
                display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 14,
                transition: 'all var(--dur-fast) var(--ease-spring-out)',
              }}
            >
              <IconCheck size={desktop ? 13 : 14} stroke={3} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => navigate('/movimientos')}
              style={{
                flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none',
                padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text)',
              }}
            >
              <CategoryAvatar
                icon={cat?.icon ?? (isIncome ? 'salary' : 'other')}
                color={cat ? categoryColor(cat) : UNCATEGORIZED_COLOR}
                size={desktop ? 36 : 38}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-md)', fontWeight: 500, minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.concept}</span>
                  {tx.source && <ArrivedAloneMark />}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: isLate ? 'var(--danger-text)' : 'var(--text-muted)' }}>
                  {isLate ? `${t('home.overdue')} ` : ''}{shortDay(relevantDate(tx))}
                </div>
              </div>
            </button>
            <span
              className="figures"
              style={{
                fontWeight: 700, fontSize: 16,
                color: isPaid ? 'var(--text-faint)' : isIncome ? 'var(--positive-text)' : 'var(--text)',
                textDecoration: isPaid ? 'line-through' : 'none',
              }}
            >
              {isIncome ? '+ ' : ''}{formatMoney(tx.amount)}
            </span>
          </div>
        );
      })}
    </div>
  );

  if (desktop) {
    const name = settings.displayName.trim();
    const dateLine = new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
    }).format(new Date(`${today}T12:00:00Z`));
    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
    const card: React.CSSProperties = {
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22,
    };
    return (
      <div className="screen screen-wide">
        <header style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {dateLine.charAt(0).toUpperCase() + dateLine.slice(1)}
            </div>
            <h1 style={{ margin: '2px 0 0', fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.2 }}>
              {name ? `${t('home.hello')}, ${name}` : t('home.title')}
            </h1>
          </div>
          {nav}
          <label
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: 300, height: 40, padding: '0 10px 0 14px',
              borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text-faint)',
            }}
          >
            <IconSearch size={17} stroke={1.9} aria-hidden style={{ flex: 'none' }} />
            <input
              ref={searchRef}
              id={SEARCH_INPUT_ID}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); } }}
              placeholder={t('desk.search')}
              aria-label={t('desk.search')}
              aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
              style={{
                flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none', background: 'none',
                color: 'var(--text)', fontSize: 14,
              }}
            />
            <kbd
              aria-hidden
              style={{
                flex: 'none', fontFamily: 'inherit', fontSize: 11, border: '1px solid var(--line-strong)',
                borderRadius: 5, padding: '1px 6px', color: 'var(--text-faint)',
              }}
            >
              {isMac ? '⌘K' : 'Ctrl K'}
            </kbd>
          </label>
          <InboxButton desktop />
          <button
            type="button"
            onClick={() => { haptic('light'); setQuickOpen(true); }}
            style={{
              // A fixed width: "New transaction" and "Nuevo movimiento" differ,
              // and the month arrows beside it must not move with the language.
              width: 196, justifyContent: 'center',
              height: 40, padding: '0 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'var(--q10)', color: 'var(--on-accent)', fontWeight: 700, fontSize: 14,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <IconPlus size={17} stroke={2.4} aria-hidden />
            {t('desk.newTransaction')}
          </button>
        </header>

        <div
          data-testid="home-columns"
          style={{ display: 'grid', gridTemplateColumns: '410px minmax(0, 1fr)', gap: 24, marginTop: 26, alignItems: 'start' }}
        >
          {!hasTransactions ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
              <InboxCard />
              {emptyHome}
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            {overdueBanner}
            <section style={{ ...card, padding: 24 }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>
                {fill(t('home.heroLineNoName'), { month: monthInSentence })}
              </h2>
              <div style={{ marginTop: 8 }}>
                <BigAmount
                  value={monthBalance.leftover}
                  size={52}
                  color={monthBalance.leftover >= 0 ? 'var(--text)' : 'var(--danger-text)'}
                />
              </div>
              {periodLine}
              {flowGrid}
            </section>

            <InboxCard />

            <section style={{ ...card, padding: '18px 18px 8px' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>{t('home.leftThisMonth')}</h2>
              {upcomingList}
            </section>

            <section style={{ ...card, padding: 18 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t('budgets.title')}</h2>
              <BudgetColumns
                categories={categories}
                budgets={budgets}
                transactions={transactions}
                monthPrefix={`${year}-${String(month).padStart(2, '0')}`}
              />
            </section>
          </div>
          )}

          <TransactionsScreen embedded={{ year, month, query, onQueryChange: setQuery }} />
        </div>

        {porPagarOpen && (
          <ToPaySheet toPay={toPay} onClose={() => setPorPagarOpen(false)} />
        )}
        <QuickActions open={quickOpen} onClose={() => setQuickOpen(false)} />
      </div>
    );
  }

  return (
    <HomeFrame>
      {header}

      {overdueBanner}

      {/* Hero: how the month ends up if everything goes as planned. No
          coloured card — the one big number is the whole point. */}
      <section style={{ textAlign: 'center', padding: '34px 0 30px' }}>
        <h1 style={{ margin: 0, fontSize: 15, fontWeight: 400, color: 'var(--text-muted)' }}>
          {heroLine}
        </h1>
        <div style={{ marginTop: 8 }}>
          <BigAmount
            value={monthBalance.leftover}
            size={56}
            color={monthBalance.leftover >= 0 ? 'var(--text)' : 'var(--danger-text)'}
          />
        </div>
        {periodLine}
      </section>

      {flowGrid}

      <InboxCard style={{ marginTop: 16 }} />

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '30px 0 10px' }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.015em', margin: 0 }}>
          {t('home.leftThisMonth')}
        </h2>
        <button
          type="button"
          onClick={() => navigate('/movimientos')}
          style={{ background: 'none', border: 'none', padding: '8px 0', color: 'var(--q10-text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          {t('home.seeAllShort')}
        </button>
      </div>

      {upcomingList}

      <button
        type="button"
        onClick={() => navigate('/movimientos')}
        className="row-hover"
        style={{ marginTop: 12, width: '100%', minHeight: 50, borderRadius: 16, border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--text)', fontWeight: 600, cursor: 'pointer', fontSize: 15 }}
      >
        {t('home.seeAll')}
      </button>

      {porPagarOpen && (
        <ToPaySheet toPay={toPay} onClose={() => setPorPagarOpen(false)} />
      )}
    </HomeFrame>
  );
}

/** Same width and gutter as Screen, without its title row: Inicio has its own header. */
function HomeFrame({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 var(--gap-l)' }}>{children}</div>;
}

function FlowCell({ label, value, tone, onClick, inset = false }: {
  label: string; value: number; tone: 'positive' | 'plain' | 'danger'; onClick?: () => void;
  /** Desktop (§9g 2a): the cells sit inside the hero card, on --hover. */
  inset?: boolean;
}) {
  // A zero is not news: it goes grey whatever the cell (prototype 1a).
  const color = value === 0 ? 'var(--text-faint)'
    : tone === 'positive' ? 'var(--positive-text)'
    : tone === 'danger' ? 'var(--danger-text)'
    : 'var(--text)';
  const body = (
    <>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span className="figures" style={{ display: 'block', fontSize: inset ? 16 : 17, fontWeight: 700, color, marginTop: inset ? 0 : 2, letterSpacing: 'normal' }}>
        {formatMoney(value)}
      </span>
    </>
  );
  const cell: React.CSSProperties = {
    background: inset ? 'var(--hover)' : 'var(--surface)', padding: inset ? '12px 14px' : '14px 16px', textAlign: 'left',
  };
  if (!onClick) return <div style={cell}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className="row-hover"
      style={{ ...cell, border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>{body}</span>
      <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: 20, flex: 'none' }}>›</span>
    </button>
  );
}

/**
 * What a period is called in the hero's context line. With two or more pay days it's the
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
  return `${monthFromLabel()} ${day}`;
}
