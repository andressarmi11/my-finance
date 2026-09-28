import { useT } from '@/i18n/language';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { formatCompact, formatMoney } from '@/domain/money/format';
import { categoryColor } from '@/domain/seed/categoryColor';
import { calculateBudgetStatus } from '@/domain/budget/status';
import type { Budget, Category, Transaction } from '@/domain/types';

/**
 * Budgets as vertical columns: the grey column IS the budget and what fills
 * up from the bottom IS what's been spent. One tank per category.
 *
 * Vertical, and not the horizontal bar from the Budgets screen, on purpose:
 * here the question isn't "how much do I have left in Food" but "which one
 * is filling up on me". Lined up in a row, relative height compares at a
 * glance, which is exactly what a stack of horizontal bars doesn't allow.
 *
 * Only categories WITH a budget show up. Drawing empty columns for the ones
 * without would fill the chart with noise; setting them is still Settings'
 * job.
 */
export function BudgetColumns({ categories, budgets, transactions, monthPrefix }: {
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  /** 'YYYY-MM' of the month being looked at. */
  monthPrefix: string;
}) {
  const t = useT();
  const byCategory = new Map(categories.map((c) => [c.id, c]));

  const spentByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.status === 'cancelled') continue;
    if (!tx.categoryId || !tx.date.startsWith(monthPrefix)) continue;
    spentByCategory.set(tx.categoryId, (spentByCategory.get(tx.categoryId) ?? 0) + tx.amount);
  }

  const columns = budgets
    .filter((b) => b.amount > 0 && byCategory.has(b.categoryId))
    .map((b) => {
      const category = byCategory.get(b.categoryId)!;
      const spent = spentByCategory.get(b.categoryId) ?? 0;
      const status = calculateBudgetStatus(spent, b.amount).state;
      return {
        category,
        spent,
        budgeted: b.amount,
        ratio: spent / b.amount,
        status,
      };
    })
    // Fullest first: that's what you need to look at.
    .sort((a, b) => b.ratio - a.ratio);

  if (columns.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>
        {t('analytics.noBudgets')}
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
      {columns.map((c) => {
        const full = Math.min(1, c.ratio);
        const exceeded = c.ratio > 1;
        const color = exceeded ? 'var(--danger)' : c.status === 'warning' ? 'var(--q25)' : 'var(--positive)';
        const pct = Math.round(c.ratio * 100);
        return (
          <div
            key={c.category.id}
            title={t('budgets.spentOfBudget')
              .replace('{name}', c.category.name)
              .replace('{spent}', formatMoney(c.spent))
              .replace('{budget}', formatMoney(c.budgeted))}
            style={{ flex: 'none', width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
          >
            <span
              className="figures"
              style={{
                fontSize: 'var(--text-xs)', fontWeight: 700,
                color: exceeded ? 'var(--danger-text)' : 'var(--text-muted)',
              }}
            >
              {pct}%
            </span>

            <div
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${c.category.name}, ${pct}% del presupuesto`}
              style={{
                position: 'relative', width: '100%', height: 96,
                borderRadius: 10, background: 'var(--surface-sunken)',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0,
                  height: `${full * 100}%`,
                  // Hatched once it's over. A full column looks the same at
                  // 100% as at 125%, and that's exactly the difference that
                  // matters. Same language as the horizontal bar on the
                  // Budgets screen: stripes = overflow.
                  background: exceeded
                    ? `repeating-linear-gradient(135deg, ${color} 0 5px, color-mix(in srgb, ${color} 55%, transparent) 5px 10px)`
                    : color,
                  transition: 'height var(--dur-med, 240ms) var(--ease-spring-out, ease-out)',
                }}
              />
            </div>

            <span style={{ color: categoryColor(c.category), lineHeight: 0 }}>
              <CategoryIcon icon={c.category.icon} size={17} />
            </span>
            <span
              className="figures"
              style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)' }}
            >
              {formatCompact(c.budgeted)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
