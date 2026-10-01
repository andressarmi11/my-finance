import type { BudgetSummary } from '@/domain/budget/kind';
import { useT } from '@/i18n/language';
import { fill } from '@/lib/dateLabels';
import { columnAmount } from '@/features/analytics/BudgetColumns';

type T = ReturnType<typeof useT>;

/** "Gastos 89% · Ahorro 86%": each part only if it exists. */
export function budgetHeader(t: T, s: BudgetSummary): string {
  return [
    s.spending ? fill(t('budgets.spendingPct'), { pct: s.spending.pct }) : '',
    s.savings ? fill(t('budgets.savingsPct'), { pct: s.savings.pct }) : '',
  ].filter(Boolean).join(' · ');
}

/** "Gastaste 2,5M de 3M · Ahorraste 3M de 3,5M". */
export function budgetSubtitle(t: T, s: BudgetSummary): string {
  return [
    s.spending ? fill(t('budgets.spentSummary'), { spent: columnAmount(s.spending.spent), limit: columnAmount(s.spending.limit) }) : '',
    s.savings ? fill(t('budgets.savedSummary'), { spent: columnAmount(s.savings.spent), limit: columnAmount(s.savings.limit) }) : '',
  ].filter(Boolean).join(' · ');
}

/**
 * The two stats over the columns (PRESUPUESTOS-Y-AHORRO.md): Gastos
 * ("4,2M de 4,7M", % in --text, --danger when over) and Ahorro ("3M de
 * 3,5M", % in --positive). Each only if it exists.
 */
export function BudgetStats({ summary, size = 14 }: { summary: BudgetSummary; size?: number }) {
  const t = useT();
  const stats = [
    summary.spending && {
      key: 'spending', label: t('budgets.statSpending'), totals: summary.spending,
      color: summary.spending.over ? 'var(--danger-text)' : 'var(--text)',
    },
    summary.savings && {
      key: 'savings', label: t('budgets.statSavings'), totals: summary.savings, color: 'var(--positive-text)',
    },
  ].filter((s): s is NonNullable<typeof s> => Boolean(s));
  if (stats.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {stats.map((s) => (
        <div key={s.key} data-testid={`budget-stat-${s.key}`} style={{ background: 'var(--paper)', borderRadius: 12, padding: size > 14 ? '10px 12px' : '9px 11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>{s.label}</span>
            <span className="figures" style={{ fontWeight: 700, color: s.color }}>{s.totals.pct}%</span>
          </div>
          <div className="figures" style={{ fontSize: size, fontWeight: 700, marginTop: 2 }}>
            {fill(t('budgets.statValue'), { spent: columnAmount(s.totals.spent), limit: columnAmount(s.totals.limit) })}
          </div>
        </div>
      ))}
    </div>
  );
}
