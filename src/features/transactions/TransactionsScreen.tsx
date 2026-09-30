import { useT } from '@/i18n/language';
import { useEffect, useMemo, useState } from 'react';
import { useDialogo } from '@/components/ui/useDialogo';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { MonthNav, monthName, widestMonthLabel } from '@/components/ui/MonthNav';
import { Segmented } from '@/components/ui/Segmented';
import { IconChevronDown } from '@tabler/icons-react';
import { fill } from '@/lib/dateLabels';
import { CalendarView } from '@/features/calendar/CalendarView';
import { db } from '@/data/db';
import { localRepository, DEFAULT_SETTINGS } from '@/data/local/localRepository';
import { deleteInstallmentPlan, createInstallmentPlan } from '@/data/local/installmentPlans';
import { seedDemoTransactions } from '@/data/local/demoData';
import { ensureMonthMaterialized } from '@/data/local/materialize';
import { maybeScheduleReminder } from '@/features/notifications/scheduleReminder';
import { formatMoney } from '@/domain/money/format';
import { periodsOfMonth } from '@/domain/period/period';
import { withResolvedPeriods } from '@/domain/period/resolve';
import { shiftMonth } from '@/domain/dates';
import { todayISO } from '@/lib/todayISO';
import { interpretText } from '@/domain/nlp/interpret';
import type { Transaction } from '@/domain/types';
import { groupByPeriod } from './groupByPeriod';
import { applyFilters, type StatusFilter, type TypeFilter } from './filters';
import { TransactionRow } from './TransactionRow';
import { TransactionForm, type Prefill } from './TransactionForm';
import { EMPTY } from '@/lib/empty';


export function TransactionsScreen() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | undefined>();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  // null = we're not selecting. An empty Set = selection mode, with nothing
  // chosen yet. modify
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const today = todayISO();
  const [todayYear, todayMonth] = today.split('-').map(Number) as [number, number];
  const [cursor, setCursor] = useState({ y: todayYear, m: todayMonth });
  const isCurrentMonth = cursor.y === todayYear && cursor.m === todayMonth;

  // See DashboardScreen: the month being viewed needs its recurring
  // instances created, even if it's two years out.
  useEffect(() => { void ensureMonthMaterialized(cursor.y, cursor.m); }, [cursor]);

  const settings = useLiveQuery(() => localRepository.getSettings(), []) ?? DEFAULT_SETTINGS;
  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const paymentMethods = useLiveQuery(() => localRepository.listPaymentMethods(), []) ?? EMPTY;
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? EMPTY;
  // What the app has learned: the Shortcut deep link has to use it too.
  //
  // WITHOUT `?? VACIO` on purpose, unlike the ones above. useLiveQuery
  // returns undefined while loading and [] once it loaded and there's
  // nothing; collapsing both into [] makes it impossible to tell "I don't
  // know yet what I've learned" apart from "I haven't learned anything".
  // The effect below needs that distinction: if it runs too early with
  // [], it proposes the category from the keyword table and exactly what
  // was learned gets lost.
  const conceptIndex = useLiveQuery(() => db.conceptIndex.toArray(), []);

  // Open the form from a URL. Two forms, both for iOS Shortcuts:
  //
  //   field by field:
  //     /movimientos?nuevo=1&tipo=ingreso&monto=3000000&concepto=Sueldo
  //   in Spanish, which the app interprets:
  //     /movimientos?texto=gasté 45 mil en el almuerzo
  //     /movimientos?texto=<the whole bank SMS>
  //
  // The second exists because building the URL field by field forces the
  // Shortcut to pull the amount out with a regular expression, and the
  // SMS format is the bank's call. Sending the raw text, the app is the
  // one that interprets it — and it already knows what category you
  // assigned last time.
  useEffect(() => {
    const text = params.get('texto') ?? params.get('sms');
    if (params.get('nuevo') !== '1' && !text) return;

    // Wait for Dexie to return the payment methods before consuming the
    // URL. The effect runs on the first render, when useLiveQuery hasn't
    // resolved yet and `paymentMethods` is []; if we cleared the params
    // right then, `metodoPorTipo` returned null and the second pass —
    // this time with the methods loaded — no longer found anything in
    // the URL. It showed up right where it hurts most: an iOS Shortcut
    // opening the app cold left the expense with no payment method, with
    // no way to recover it.
    if (paymentMethods.length === 0) return;
    // And wait for what's been learned too, for the same reason: if the
    // effect runs before Dexie answers, the index arrives empty and the
    // category the user had already corrected gets silently lost. It
    // showed up as flakiness: sometimes the Shortcut got it right and
    // sometimes it didn't.
    if (conceptIndex === undefined) return;

    let next: Prefill;
    if (text) {
      // Same interpretation as quick entry and the inbox. This used to
      // only use the keyword table, so whatever the user had corrected
      // in the app got ignored when coming in through the Shortcut.
      const { parsed: read, categoryId, paymentMethodId } = interpretText(text, todayISO(), {
        conceptIndex,
        categoryIds: categories.map((c) => c.id),
        methodRows: paymentMethods,
        defaultMethodId: settings.defaultPaymentMethodId ?? null,
      });
      next = {
        type: read.type,
        concept: read.concept || undefined,
        amountText: read.amount != null ? String(read.amount) : undefined,
        date: read.date,
        categoryId,
        paymentMethodId,
        markPaidNow: read.yaOcurrio,
      };
    } else {
      next = {
        type: params.get('tipo') === 'ingreso' ? 'income' : 'expense',
        concept: params.get('concepto') ?? undefined,
        amountText: (params.get('monto') ?? '').replace(/[^0-9]/g, '') || undefined,
        date: params.get('fecha') ?? undefined,
        markPaidNow: params.get('pagado') === '1' ? true : undefined,
      };
    }

    setEditing(null);
    setPrefill(next);
    setFormOpen(true);
    const cleaned = new URLSearchParams(params);
    for (const k of ['nuevo', 'tipo', 'monto', 'concepto', 'fecha', 'pagado', 'texto', 'sms']) cleaned.delete(k);
    setParams(cleaned, { replace: true });
  }, [params, setParams, paymentMethods, categories, conceptIndex, settings]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const methodById = useMemo(() => new Map(paymentMethods.map((m) => [m.id, m])), [paymentMethods]);

  // Searching looks at the WHOLE history; without a search, the list is
  // scoped to the visible month. Without that cap, recurring
  // transactions materialized +95 days out showed up above everything
  // and buried this week's.
  const searching = query.trim().length > 0;

  const visibleRows = useMemo(() => {
    const inWindow = searching
      ? transactions.filter((t) => t.concept.toLowerCase().includes(query.trim().toLowerCase()))
      // As many keys as the month has periods. Asking for Q1 and Q2 by
      // hand left out transactions as soon as the periods weren't exactly two.
      : withResolvedPeriods(transactions, settings.payDays)
          .filter((t) => periodsOfMonth(cursor.y, cursor.m, settings.payDays).includes(t.recordPeriodKey));
    return applyFilters(inWindow, typeFilter, statusFilter);
  }, [transactions, query, searching, cursor, settings.payDays, typeFilter, statusFilter]);

  const groups = useMemo(
    () => groupByPeriod(visibleRows, settings.payDays, transactions),
    [visibleRows, settings.payDays, transactions],
  );

  const monthTotal = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of visibleRows) {
      if (t.status === 'cancelled') continue;
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, count: visibleRows.length };
  }, [visibleRows]);

  const inSelection = selection !== null;

  // Lista | Calendario lives in the URL (?vista=calendario), so the back
  // button, links and the old /calendario path all land on the right view.
  const calendarView = params.get('vista') === 'calendario';
  function setView(next: 'lista' | 'calendario') {
    const updated = new URLSearchParams(params);
    if (next === 'calendario') updated.set('vista', 'calendario');
    else updated.delete('vista');
    setSelection(null);
    setParams(updated, { replace: true });
  }

  // Folded groups, by period key, remembered across reloads.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsed);
  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next[key]) delete next[key];
      saveCollapsed(next);
      return next;
    });
  }

  function selectAllVisible() {
    setSelection(new Set(visibleRows.map((tx) => tx.id)));
  }

  function toggleSelection(id: string) {
    setSelection((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /** The chosen transactions, in the order they're shown. */
  const selectedIds = useMemo(
    () => (selection ? visibleRows.filter((t) => selection.has(t.id)) : []),
    [selection, visibleRows],
  );

  async function markSelectedPaid() {
    setApplying(true);
    try {
      const now = new Date().toISOString();
      for (const tx of selectedIds) {
        if (tx.status === 'paid') continue; // already was; don't move its date
        await localRepository.saveTransaction({ ...tx, status: 'paid', updatedAt: now });
      }
      setSelection(null);
    } finally {
      setApplying(false);
    }
  }

  async function deleteSelected() {
    setApplying(true);
    try {
      for (const tx of selectedIds) await localRepository.deleteTransaction(tx.id);
      setConfirmDelete(false);
      setSelection(null);
    } finally {
      setApplying(false);
    }
  }

  async function togglePaid(tx: Transaction) {
    await localRepository.saveTransaction({
      ...tx,
      status: tx.status === 'paid' ? 'pending' : 'paid',
      updatedAt: new Date().toISOString(),
    });
  }

  async function handleSave(tx: Transaction, installmentPlan?: { installments: number; installmentAmount?: number }) {
    if (installmentPlan && installmentPlan.installments > 1) {
      const method = tx.paymentMethodId ? paymentMethods.find((m) => m.id === tx.paymentMethodId) : undefined;
      await createInstallmentPlan(tx, installmentPlan.installments, method, installmentPlan.installmentAmount);
      closeForm();
      return;
    }
    await localRepository.saveTransaction(tx);
    void maybeScheduleReminder(tx, settings).catch((e: unknown) => {
      console.error(t('transactions.couldNotScheduleReminder'), e);
    });
    closeForm();
  }

  /** Deleting one installment deletes the entire plan: one with a hole
   *  at installment 7 means nothing, and silently throws off the limit. */
  async function handleDelete() {
    if (!editing) return;
    await deleteInstallmentPlan(editing);
    closeForm();
  }

  async function handleDuplicate() {
    if (!editing) return;
    const now = new Date().toISOString();
    await localRepository.saveTransaction({
      ...editing,
      id: crypto.randomUUID(),
      status: 'pending',
      quincenaKey: null,
      createdAt: now,
      updatedAt: now,
    });
    closeForm();
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setPrefill(undefined);
  }

  async function handleLoadDemo() {
    setLoadingDemo(true);
    try {
      await seedDemoTransactions();
    } finally {
      setLoadingDemo(false);
    }
  }

  const nav = (
    <MonthNav
      compact
      label={`${monthName(cursor.m).slice(0, 3)} ${cursor.y}`}
      widthSample={widestMonthLabel(true)}
      todayIsAhead={cursor.y * 12 + cursor.m < todayYear * 12 + todayMonth}
      onPrev={() => setCursor((c) => shiftMonth(c.y, c.m, -1))}
      onNext={() => setCursor((c) => shiftMonth(c.y, c.m, 1))}
      onToday={isCurrentMonth ? undefined : () => setCursor({ y: todayYear, m: todayMonth })}
    />
  );

  const dialogRef = useDialogo(() => setConfirmDelete(false), confirmDelete);
  return (
    <Screen
      title={inSelection
        ? t('transactions.nSelected')
            .replace('{n}', String(selectedIds.length))
            .replace('{s}', selectedIds.length === 1 ? '' : 's')
        : t('transactions.title')}
      back={inSelection ? undefined : { label: t('nav.home'), to: '/' }}
      backAction={inSelection ? (
        <button type="button" onClick={() => setSelection(null)} style={buttonText}>{t('action.cancel')}</button>
      ) : (!calendarView && transactions.length > 0 ? (
        <button type="button" onClick={() => setSelection(new Set())} style={buttonText}>{t('action.select')}</button>
      ) : undefined)}
      right={inSelection || searching ? undefined : nav}
    >
      {!inSelection && (
        <div style={{ marginBottom: 'var(--gap-m)' }}>
          <Segmented
            label={t('transactions.view')}
            value={calendarView ? 'calendario' : 'lista'}
            onChange={setView}
            options={[
              { value: 'lista', label: t('transactions.viewList') },
              { value: 'calendario', label: t('transactions.viewCalendar') },
            ]}
          />
        </div>
      )}

      {calendarView ? <CalendarView year={cursor.y} month={cursor.m} /> : (<>
      {transactions.length > 0 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('transactions.search')}
          type="search"
          style={{
            width: '100%', minHeight: 'var(--tap)', padding: '0 14px', marginBottom: 'var(--gap-m)',
            borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
            background: 'var(--surface)', color: 'var(--text)', fontSize: 16,
          }}
        />
      )}

      {transactions.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--gap-m)', overflowX: 'auto', paddingBottom: 2 }}>
          <Chip activeRecognizer={typeFilter === 'todos' && statusFilter === 'todos'}
            onClick={() => { setTypeFilter('todos'); setStatusFilter('todos'); }}>{t('filter.all')}</Chip>
          <Chip activeRecognizer={typeFilter === 'expense'} onClick={() => setTypeFilter(typeFilter === 'expense' ? 'todos' : 'expense')}>{t('filter.expenses')}</Chip>
          <Chip activeRecognizer={typeFilter === 'income'} onClick={() => setTypeFilter(typeFilter === 'income' ? 'todos' : 'income')}>{t('filter.income')}</Chip>
          <Chip activeRecognizer={statusFilter === 'pendientes'} onClick={() => setStatusFilter(statusFilter === 'pendientes' ? 'todos' : 'pendientes')}>{t('filter.pending')}</Chip>
          <Chip activeRecognizer={statusFilter === 'pagados'} onClick={() => setStatusFilter(statusFilter === 'pagados' ? 'todos' : 'pagados')}>{t('filter.paid')}</Chip>
        </div>
      )}

      {/* Summary of the visible month — context before the list.
          In two lines, not one: at iPhone width, the count, the two
          amounts and the button don't fit together — "8 transactions"
          used to wrap into two lines and the numbers ended up cramped
          against the edge. */}
      {!searching && transactions.length > 0 && (
        <div
          style={{
            padding: '10px 14px', marginBottom: 'var(--gap-m)',
            background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {monthTotal.count} {monthTotal.count === 1 ? t('transactions.transaction') : t('transactions.transactionsPl')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 'var(--text-md)', fontWeight: 700, marginTop: 2 }}>
            <span className="figures" style={{ color: 'var(--positive-text)' }}>+ {formatMoney(monthTotal.income)}</span>
            <span className="figures" style={{ color: 'var(--danger-text)' }}>− {formatMoney(monthTotal.expense)}</span>
          </div>
        </div>
      )}

      {transactions.length === 0 ? (
        <EmptyState
          title={t('transactions.emptyTitle')}
          body={t('transactions.emptyBody')}
          action={{ label: loadingDemo ? 'Cargando...' : 'Cargar datos de ejemplo', onClick: handleLoadDemo }}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          title={searching ? t('transactions.noResultsTitle') : t('transactions.empty')}
          body={searching
            ? `${t('transactions.nothingMatches')} "${query}".`
            : `${t('transactions.noTransactionsThisMonth')} ${monthName(cursor.m).toLowerCase()} ${cursor.y}.`}
        />
      ) : (
        groups.map((group) => {
          const isCollapsed = collapsed[group.key] === true;
          return (
          <section key={group.key} style={{ marginBottom: 'var(--gap-l)' }}>
            {/* The header sits OUTSIDE the card, so the card only holds
                rows and "Restante". It's a button: tapping it folds the
                group, and the fold survives a reload (by period key). */}
            <button
              type="button"
              onClick={() => toggleCollapsed(group.key)}
              aria-expanded={!isCollapsed}
              aria-label={fill(t('transactions.collapseGroup'), { group: group.label })}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                minHeight: 'var(--tap)', padding: '0 4px', marginBottom: 4,
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                color: 'var(--text)',
              }}
            >
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, flex: 'none', background: `var(${group.colorVar})` }} />
              <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: `var(${group.colorVar}-text)` }}>{group.label}</span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-faint)', flex: 1, minWidth: 0 }}>{group.rangeLabel}</span>
              <IconChevronDown
                size={18}
                stroke={2}
                aria-hidden
                style={{
                  flex: 'none', color: 'var(--text-faint)',
                  transform: isCollapsed ? 'rotate(-90deg)' : 'none',
                  transition: 'transform var(--dur-fast) var(--ease-spring-out)',
                }}
              />
            </button>

            {isCollapsed ? (
              <div
                className="figures"
                style={{
                  background: 'var(--surface)', border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-card)', padding: '12px 16px',
                  fontSize: 'var(--text-sm)', color: 'var(--text-muted)',
                }}
              >
                {fill(t('transactions.collapsedSummary'), {
                  n: group.transactions.length,
                  amount: formatMoney(group.balance.remainder),
                })}
              </div>
            ) : (
            <div
              style={{
                // Neutral surface, not a tinted block: the pay period's
                // color lives in the dot and the label. Tinting the whole
                // area made the background compete with the amounts,
                // which are what you came here to read.
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-card)',
                padding: '4px 14px 4px',
              }}
            >

              {group.transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  category={tx.categoryId ? categoryById.get(tx.categoryId) : undefined}
                  paymentMethod={tx.paymentMethodId ? methodById.get(tx.paymentMethodId) : undefined}
                  onTogglePaid={() => togglePaid(tx)}
                  onOpen={() => { setEditing(tx); setFormOpen(true); }}
                  selected={selection?.has(tx.id)}
                  onSeleccionar={inSelection ? () => toggleSelection(tx.id) : undefined}
                />
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 8px' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('transactions.remaining')}</span>
                <span className="figures" style={{ fontWeight: 700, color: group.balance.remainder >= 0 ? 'var(--positive-text)' : 'var(--danger-text)' }}>
                  {formatMoney(group.balance.remainder)}
                </span>
              </div>
            </div>
            )}
          </section>
          );
        })
      )}
      </>)}

      {inSelection && (
        <div
          role="toolbar"
          aria-label={t('transactions.selectionActions')}
          style={{
            position: 'fixed', left: 14, right: 14,
            // Floating right above the tab bar pill (12px gap + 62px).
            bottom: 'calc(var(--safe-bottom) + 12px + var(--tabbar-h) + 10px)',
            maxWidth: 560, marginInline: 'auto',
            zIndex: 45, display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 8px 8px 16px',
            background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--line-strong)',
            borderRadius: 20,
            boxShadow: 'var(--shadow-3)',
          }}
        >
          <span className="figures" style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t('transactions.nSelected')
              .replace('{n}', String(selectedIds.length))
              .replace('{s}', selectedIds.length === 1 ? '' : 's')}
          </span>
          <button
            type="button"
            onClick={selectAllVisible}
            style={{ ...buttonText, padding: '0 8px' }}
          >
            {t('transactions.selectAll')}
          </button>
          <button
            type="button"
            onClick={markSelectedPaid}
            disabled={selectedIds.length === 0 || applying}
            style={actionStyle(selectedIds.length > 0 && !applying, 'var(--positive)', 'var(--positive-text)')}
          >
            {t('transactions.markPaidShort')}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={selectedIds.length === 0 || applying}
            style={actionStyle(selectedIds.length > 0 && !applying, 'var(--danger)', 'var(--danger-text)')}
          >
            {t('action.delete')}
          </button>
        </div>
      )}

      {confirmDelete && (
        <div
      ref={dialogRef}
          role="dialog"
          aria-label={t('transactions.confirmDeleteLabel')}
          onClick={() => setConfirmDelete(false)}
          style={{
            position: 'fixed', inset: 0, background: 'color-mix(in srgb, black 40%, transparent)',
            display: 'flex', alignItems: 'flex-end', zIndex: 70,
            animation: 'fadeIn var(--dur-fast) var(--ease-spring-out)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560, margin: '0 auto', background: 'var(--surface)',
              borderRadius: '20px 20px 0 0', padding: '10px 20px calc(var(--safe-bottom) + 20px)',
              animation: 'slideUp var(--dur-med) var(--ease-spring-out)',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 16px' }} />
            <h2 style={{ margin: '0 0 6px', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
              {t('transactions.deleteQuestion')
                .replace('{n}', String(selectedIds.length))
                .replace('{noun}', selectedIds.length === 1 ? t('transactions.transaction') : t('transactions.transactionsPl'))}
            </h2>
            <ul
              className="divided"
              style={{
                listStyle: 'none', margin: '0 0 12px', padding: '0 14px',
                maxHeight: 220, overflowY: 'auto',
                background: 'var(--paper)', borderRadius: 14, border: '1px solid var(--line)',
              }}
            >
              {selectedIds.map((tx) => (
                <li key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', fontSize: 'var(--text-base)' }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.concept}</span>
                  <span className="figures" style={{ flex: 'none', fontWeight: 600 }}>{formatMoney(tx.amount)}</span>
                </li>
              ))}
            </ul>
            <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 'var(--text-base)', lineHeight: 'var(--lh-normal)' }}>
              {t('transactions.theyAddUpTo')} {formatMoney(selectedIds.reduce((a, tx) => a + tx.amount, 0))}.{' '}
              {t('transactions.deleteWarning')}
            </p>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={applying}
              style={{
                width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none',
                background: 'var(--danger)', color: 'var(--on-accent)', fontWeight: 700, fontSize: 16,
                cursor: applying ? 'not-allowed' : 'pointer', marginBottom: 8,
              }}
            >
              {applying ? t('action.deleting') : t('transactions.yesDelete')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              style={{
                width: '100%', minHeight: 44, borderRadius: 'var(--radius-s)', border: 'none',
                background: 'var(--surface-sunken)', color: 'var(--text)', fontWeight: 600,
                fontSize: 'var(--text-base)', cursor: 'pointer',
              }}
            >
              {t('action.cancel')}
            </button>
          </div>
        </div>
      )}

      {formOpen && (
        <TransactionForm
          existing={editing}
          prefill={editing ? undefined : prefill}
          categories={categories}
          paymentMethods={paymentMethods}
          defaultPaymentMethodId={settings.defaultPaymentMethodId ?? paymentMethods.find((m) => m.isDefault)?.id ?? null}
          onSave={handleSave}
          onDelete={editing ? handleDelete : undefined}
          onDuplicate={editing ? handleDuplicate : undefined}
          onCancel={closeForm}
        />
      )}
    </Screen>
  );
}

const buttonText: React.CSSProperties = {
  border: 'none', background: 'none', color: 'var(--q10-text)',
  fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer',
  minHeight: 'var(--tap)', padding: '0 4px',
};

/**
 * The border uses the identity color and the TEXT its -text variant.
 * It's not a whim: iOS green and red on white give 2.2:1 and 3.5:1,
 * below the 4.5:1 that text needs to be readable.
 */
function actionStyle(activeRecognizer: boolean, borde: string, text: string): React.CSSProperties {
  return {
    flex: 'none', minHeight: 40, padding: '0 14px', borderRadius: 12,
    border: `1px solid ${activeRecognizer ? borde : 'var(--line)'}`,
    background: 'transparent',
    color: activeRecognizer ? text : 'var(--text-faint)',
    fontWeight: 600, fontSize: 'var(--text-base)',
    cursor: activeRecognizer ? 'pointer' : 'not-allowed',
  };
}

/** Filter chip. Toggles: tapping it again turns it off. */
function Chip({ activeRecognizer, onClick, children }: {
  activeRecognizer: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activeRecognizer}
      style={{
        flex: 'none', minHeight: 34, padding: '0 14px', borderRadius: 999,
        border: `1px solid ${activeRecognizer ? 'var(--text)' : 'var(--line-strong)'}`,
        background: activeRecognizer ? 'var(--text)' : 'transparent',
        color: activeRecognizer ? 'var(--paper)' : 'var(--text)',
        fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

/** localStorage key of the folded period groups: { [periodKey]: true }. */
const COLLAPSED_KEY = 'movimientos.collapsed';

function readCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function saveCollapsed(value: Record<string, boolean>): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(value));
  } catch {
    // Private mode or storage full: folding just won't be remembered.
  }
}
