import { useT } from '@/i18n/language';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { MonthNav, monthName, widestMonthLabel } from '@/components/ui/MonthNav';
import { useDialogo } from '@/components/ui/useDialogo';
import { setBudgetForMonths, deleteBudgetForMonths } from '@/data/local/budgetMonths';
import type { YearMonth } from '@/domain/budget/months';
import { fill } from '@/lib/dateLabels';
import { shiftMonthISO } from '@/features/calendar/calendarGrid';
import { db } from '@/data/db';
import { localRepository } from '@/data/local/localRepository';
import { formatMoney } from '@/domain/money/format';
import { calculateBudgetStatus } from '@/domain/budget/status';
import { calculateSpendByCategory } from '@/domain/totals/byCategory';
import type { Category } from '@/domain/types';
import { todayISO } from '@/lib/todayISO';
import { BudgetAmountSheet } from './BudgetAmountSheet';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { BudgetColumns } from '@/features/analytics/BudgetColumns';
import { shortAmount } from '@/features/analytics/shortAmount';
import { SettingsGroup, Stepper, card, useSettingsBack } from '@/features/settings/ui';

/** Quick adjustments move by $50.000 (redesign §9d); the sheet takes any amount. */
const STEP = 50_000;
const MAX_BUDGET = 999_999_999_999;
import { categoryColor } from '@/domain/seed/categoryColor';
import { EMPTY } from '@/lib/empty';

export function BudgetsScreen() {
  const t = useT();
  const back = useSettingsBack();
  const today = todayISO();
  const [nowYear, nowMonth] = today.split('-').map(Number) as [number, number];
  // Budgets are per category AND month, so the screen browses months.
  const [view, setView] = useState({ year: nowYear, month: nowMonth });
  const { year, month } = view;
  const inCurrentMonth = year === nowYear && month === nowMonth;

  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? EMPTY;
  const budgets = useLiveQuery(() => localRepository.listBudgets(year, month), [year, month]) ?? EMPTY;
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? EMPTY;
  const [editing, setEditing] = useState<Category | null>(null);
  const [removing, setRemoving] = useState<Category | null>(null);

  const monthPrefix = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  const monthTransactions = useMemo(
    () => transactions.filter((t) => t.date.startsWith(monthPrefix)),
    [transactions, monthPrefix],
  );

  const spendByCategory = useMemo(() => {
    const totals = calculateSpendByCategory(monthTransactions);
    return new Map(totals.map((t) => [t.categoryId, t.amount]));
  }, [monthTransactions]);

  const budgetByCategory = useMemo(() => new Map(budgets.filter((b) => b.amount > 0).map((b) => [b.categoryId, b])), [budgets]);
  const expenseCategories = categories.filter((c) => !c.isArchived && (c.kind === 'expense' || c.kind === 'both'));

  async function handleSaveBudget(months: YearMonth[], amount: number) {
    if (!editing) return;
    await setBudgetForMonths(editing.id, months, amount);
    setEditing(null);
  }

  async function handleRemove() {
    if (!removing) return;
    // Only the month being viewed: removing "everywhere" from a screen that
    // shows one month would delete things the user can't see.
    await deleteBudgetForMonths(removing.id, [{ year, month }]);
    setRemoving(null);
    setEditing(null);
  }

  const budgeted = expenseCategories.filter((c) => budgetByCategory.has(c.id));
  const totalLimit = budgeted.reduce((sum, c) => sum + budgetByCategory.get(c.id)!.amount, 0);
  const totalSpent = budgeted.reduce((sum, c) => sum + (spendByCategory.get(c.id) ?? 0), 0);

  return (
    <Screen title={t('budgets.title')} subtitle={t('set.budgetsIntro')} back={back}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <MonthNav
          label={`${monthName(month)} ${year}`}
          widthSample={widestMonthLabel()}
          todayIsAhead={year * 12 + month < nowYear * 12 + nowMonth}
          onPrev={() => setView((v) => shiftMonthISO(v.year, v.month, -1))}
          onNext={() => setView((v) => shiftMonthISO(v.year, v.month, 1))}
          onToday={inCurrentMonth ? undefined : () => setView({ year: nowYear, month: nowMonth })}
        />
      </div>

      {budgeted.length > 0 && (
        <div style={{ ...card, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>{monthName(month)}</span>
            <span className="figures" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {fill(t('set.budgetUsed'), { pct: totalLimit ? Math.round((totalSpent / totalLimit) * 100) : 0 })}
            </span>
          </div>
          <BudgetColumns categories={categories} budgets={budgets} transactions={transactions} monthPrefix={monthPrefix} />
        </div>
      )}

      <SettingsGroup style={{ marginTop: 0 }}>
        {expenseCategories.map((c) => {
          const spent = spendByCategory.get(c.id) ?? 0;
          const budget = budgetByCategory.get(c.id);
          const color = categoryColor(c);
          const over = !!budget && calculateBudgetStatus(spent, budget.amount).state === 'exceeded';
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', minHeight: 56 }}>
              <span aria-hidden style={{
                width: 36, height: 36, borderRadius: 12, flex: 'none', display: 'grid', placeItems: 'center',
                background: `color-mix(in srgb, ${color} 16%, var(--surface))`, color,
              }}>
                <CategoryIcon icon={c.icon} size={19} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span className="figures" style={{ display: 'block', fontSize: 'var(--text-xs)', color: over ? 'var(--danger-text)' : 'var(--text-muted)' }}>
                  {budget
                    ? fill(t('budgets.spentOf'), { spent: formatMoney(spent), budget: formatMoney(budget.amount) }) + (over ? ` · ${t('set.youWentOver')}` : '')
                    : spent > 0 ? fill(t('budgets.spentAmount'), { amount: formatMoney(spent) }) : t('set.noLimit')}
                </span>
              </span>
              {budget ? (
                <Stepper
                  label={fill(t('set.budgetOf'), { name: c.name, amount: formatMoney(budget.amount) })}
                  value={budget.amount}
                  min={STEP}
                  max={MAX_BUDGET}
                  step={STEP}
                  width={44}
                  format={shortAmount}
                  onValueClick={() => setEditing(c)}
                  onChange={(v) => void setBudgetForMonths(c.id, [{ year, month }], v)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(c)}
                  aria-label={`${t('budgets.define')}: ${c.name}`}
                  style={{
                    flex: 'none', border: '1px dashed var(--line-strong)', background: 'none', color: 'var(--q10-text)',
                    height: 32, padding: '0 12px', borderRadius: 16, fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer',
                  }}
                >
                  {t('analytics.define')}
                </button>
              )}
            </div>
          );
        })}
      </SettingsGroup>

      {editing && (
        <BudgetAmountSheet
          category={editing}
          key={`${editing.id}-${year}-${month}`}
          viewed={{ year, month }}
          currentAmount={budgetByCategory.get(editing.id)?.amount ?? 0}
          onSave={handleSaveBudget}
          onRemove={() => setRemoving(editing)}
          onCancel={() => setEditing(null)}
        />
      )}
      {removing && <RemoveBudgetSheet category={removing} month={monthName(month)} onConfirm={handleRemove} onCancel={() => setRemoving(null)} />}
    </Screen>
  );
}

function RemoveBudgetSheet({ category, month, onConfirm, onCancel }: { category: Category; month: string; onConfirm: () => void; onCancel: () => void }) {
  const t = useT();
  const dialogRef = useDialogo(onCancel);
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label={fill(t('budgets.removeQuestion'), { name: category.name, month, monthLower: month.toLowerCase() })}
      onClick={onCancel}
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
          {fill(t('budgets.removeQuestion'), { name: category.name, month, monthLower: month.toLowerCase() })}
        </h2>
        <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 'var(--text-base)', lineHeight: 'var(--lh-normal)' }}>
          {t('budgets.removeBody')}
        </p>
        <button type="button" onClick={onConfirm} style={{ width: '100%', minHeight: 48, borderRadius: 'var(--radius-s)', border: 'none', background: 'var(--danger)', color: 'var(--on-accent)', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginBottom: 8 }}>
          {t('budgets.yesRemove')}
        </button>
        <button type="button" onClick={onCancel} style={{ width: '100%', minHeight: 44, borderRadius: 'var(--radius-s)', border: 'none', background: 'var(--surface-sunken)', color: 'var(--text)', fontWeight: 600, fontSize: 'var(--text-base)', cursor: 'pointer' }}>
          {t('action.cancel')}
        </button>
      </div>
    </div>
  );
}
