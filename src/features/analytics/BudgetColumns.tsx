import { useNavigate } from 'react-router-dom';
import { useT } from '@/i18n/language';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { formatMoney } from '@/domain/money/format';
import { categoryColor } from '@/domain/seed/categoryColor';
import type { Budget, Category, Transaction } from '@/domain/types';
import { fill } from '@/lib/dateLabels';
import { shortAmount } from './shortAmount';

/** Column heights (redesign §9c): the dashed limit grows with the budget. */
const MIN_H = 96;
const EXTRA_H = 104;
/** How far the fill may overflow the limit, so a blown budget still fits. */
const MAX_PCT = 114;

export interface BudgetColumn {
  category: Category;
  spent: number;
  limit: number;
  pct: number;
}

/** Only categories WITH a budget, biggest limit first. */
export function budgetColumns(
  categories: Category[], budgets: Budget[], transactions: Transaction[], monthPrefix: string,
): BudgetColumn[] {
  const byCategory = new Map(categories.map((c) => [c.id, c]));
  const spentByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.status === 'cancelled') continue;
    if (!tx.categoryId || !tx.date.startsWith(monthPrefix)) continue;
    spentByCategory.set(tx.categoryId, (spentByCategory.get(tx.categoryId) ?? 0) + tx.amount);
  }
  return budgets
    .filter((b) => b.amount > 0 && byCategory.has(b.categoryId))
    .map((b) => {
      const spent = spentByCategory.get(b.categoryId) ?? 0;
      return { category: byCategory.get(b.categoryId)!, spent, limit: b.amount, pct: Math.round((spent / b.amount) * 100) };
    })
    .sort((a, b) => b.limit - a.limit);
}

/**
 * Budgets as columns (redesign §9c). The DASHED border is the limit, its
 * height proportional to the limit; the FILL rises with what's been spent,
 * in the category's colour. Over the limit, the fill sticks out of the
 * dashed box and everything turns --danger.
 *
 * Vertical on purpose: the question here is "which one is filling up",
 * and heights side by side compare at a glance. Tapping a column goes to
 * the Budgets screen, where they're set.
 */
export function BudgetColumns({ categories, budgets, transactions, monthPrefix }: {
  categories: Category[];
  budgets: Budget[];
  transactions: Transaction[];
  /** 'YYYY-MM' of the month being looked at. */
  monthPrefix: string;
}) {
  const t = useT();
  const navigate = useNavigate();
  const columns = budgetColumns(categories, budgets, transactions, monthPrefix);

  if (columns.length === 0) {
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
          border: '1.5px dashed var(--line-strong)', borderRadius: 16,
        }}
      >
        <p style={{ flex: 1, margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          {t('analytics.noBudgetsShort')}
        </p>
        <button
          type="button"
          onClick={() => navigate('/ajustes/presupuestos')}
          style={{
            flex: 'none', minHeight: 36, padding: '0 16px', borderRadius: 999, cursor: 'pointer',
            border: 'none', background: 'var(--q10)', color: 'var(--on-accent)', fontWeight: 700,
            fontSize: 'var(--text-sm)',
          }}
        >
          {t('analytics.define')}
        </button>
      </div>
    );
  }

  const maxLimit = Math.max(...columns.map((c) => c.limit));

  return (
    <div className="noscroll" style={{ display: 'flex', alignItems: 'flex-end', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingTop: 22 }}>
      {columns.map((c) => {
        const over = c.pct > 100;
        const color = categoryColor(c.category);
        const height = MIN_H + (c.limit / maxLimit) * EXTRA_H;
        const fillPct = Math.min(c.pct, MAX_PCT);
        const label = fill(t('analytics.budgetColumnLabel'), {
          name: c.category.name, spent: formatMoney(c.spent), limit: formatMoney(c.limit), pct: c.pct,
        });
        return (
          <button
            key={c.category.id}
            type="button"
            onClick={() => navigate('/ajustes/presupuestos')}
            aria-label={label}
            title={label}
            style={{
              flex: 'none', width: 84, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text)',
            }}
          >
            <span
              style={{
                position: 'relative', width: '100%', height,
                borderRadius: 20, border: `1.5px dashed ${over ? 'var(--danger)' : 'var(--handle)'}`,
              }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute', left: 3, right: 3, bottom: 3,
                  height: fillPct > 0 ? `calc(${fillPct}% - 6px)` : 0,
                  minHeight: fillPct > 0 ? 6 : 0,
                  borderRadius: 16,
                  background: over
                    ? 'color-mix(in srgb, var(--danger) 40%, var(--surface))'
                    : `color-mix(in srgb, ${color} 34%, var(--surface))`,
                  transition: 'height .5s var(--ease-spring-out)',
                }}
              />
              <span
                style={{
                  position: 'absolute', left: 0, right: 0, bottom: 10,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                }}
              >
                <span aria-hidden style={{ color, lineHeight: 0 }}><CategoryIcon icon={c.category.icon} size={18} /></span>
                <span className="figures" style={{ fontSize: 15, fontWeight: 700 }}>{shortAmount(c.spent)}</span>
                <span className="figures" style={{ fontSize: 11, fontWeight: 700, color: over ? 'var(--danger-text)' : 'var(--text-muted)' }}>
                  {c.pct}%
                </span>
              </span>
            </span>
            {/* The name, and the limit under it (prototype 1a). */}
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 84, gap: 1 }}>
              <span style={{ maxWidth: 84, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.category.name}
              </span>
              <span className="figures" style={{ fontSize: 11, color: 'var(--text-faint)' }}>{shortAmount(c.limit)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
