import { useT } from '@/i18n/idioma';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { db } from '@/data/db';
import { localRepository } from '@/data/local/localRepository';
import { formatMoney } from '@/domain/money/format';
import { calculateBudgetStatus } from '@/domain/budget/status';
import { calculateSpendByCategory } from '@/domain/totals/byCategory';
import type { Category } from '@/domain/types';
import { todayISO } from '@/lib/todayISO';
import { BudgetAmountSheet } from './BudgetAmountSheet';
import { BudgetBar } from './BudgetBar';
import { CategoryAvatar } from '@/components/ui/CategoryIcon';
import { categoryColor } from '@/domain/seed/categoryColor';
import { daysInMonth } from '@/domain/dates';
import { VACIO } from '@/lib/vacio';

export function BudgetsScreen() {
  const t = useT();
  const navigate = useNavigate();
  const today = todayISO();
  const [year, month] = today.split('-').map(Number) as [number, number];

  const categories = useLiveQuery(() => localRepository.listCategories(), []) ?? VACIO;
  const budgets = useLiveQuery(() => localRepository.listBudgets(year, month), [year, month]) ?? VACIO;
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) ?? VACIO;
  const [editing, setEditing] = useState<Category | null>(null);

  // Que tan avanzado va el mes: la marca de ritmo de la barra. Gastar el
  // 60% es bueno el dia 25 y malo el dia 5, y sin esto la barra no lo dice.
  const diaDeHoy = Number(today.split('-')[2]);
  const progresoDelMes = diaDeHoy / daysInMonth(year, month);

  const monthPrefix = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  const monthTransactions = useMemo(
    () => transactions.filter((t) => t.date.startsWith(monthPrefix)),
    [transactions, monthPrefix],
  );

  const spendByCategory = useMemo(() => {
    const totals = calculateSpendByCategory(monthTransactions);
    return new Map(totals.map((t) => [t.categoryId, t.amount]));
  }, [monthTransactions]);

  const budgetByCategory = useMemo(() => new Map(budgets.map((b) => [b.categoryId, b])), [budgets]);
  const expenseCategories = categories.filter((c) => !c.isArchived && (c.kind === 'expense' || c.kind === 'both'));

  async function handleSaveBudget(amount: number) {
    if (!editing) return;
    const existing = budgetByCategory.get(editing.id);
    await localRepository.saveBudget({
      id: existing?.id ?? crypto.randomUUID(),
      categoryId: editing.id,
      year,
      month,
      amount,
      // La fecha real la estampa localRepository.saveBudget.
      updatedAt: existing?.updatedAt ?? '',
    });
    setEditing(null);
  }

  return (
    <Screen title={t('presupuestos.titulo')} subtitle={t('presupuestos.subtitulo')}>
      <button type="button" onClick={() => navigate(-1)} style={{ marginBottom: 16, background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
        ← {t('nav.volverAjustes')}
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {expenseCategories.map((c) => {
          const spent = spendByCategory.get(c.id) ?? 0;
          const budget = budgetByCategory.get(c.id);

          if (!budget) {
            return (
              <button
                key={c.id} type="button" onClick={() => setEditing(c)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 'var(--tap)', padding: '0 14px', borderRadius: 'var(--radius-m)', border: '1px dashed var(--line-strong)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left' }}
              >
                <CategoryAvatar icon={c.icon} color={categoryColor(c)} size={32} />
                <span style={{ flex: 1, fontWeight: 600 }}>{c.name}</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>
                  {spent > 0 ? `${formatMoney(spent)} gastado` : t('presupuestos.definir')}
                </span>
              </button>
            );
          }

          const status = calculateBudgetStatus(spent, budget.amount);
          return (
            <button
              key={c.id} type="button" onClick={() => setEditing(c)}
              style={{ padding: '12px 14px', borderRadius: 'var(--radius-m)', border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <CategoryAvatar icon={c.icon} color={categoryColor(c)} size={32} />
                <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{c.name}</span>
                <span className="figures" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  {formatMoney(spent)} de {formatMoney(budget.amount)}
                </span>
              </div>
              <BudgetBar
                gastado={spent}
                presupuestado={budget.amount}
                estado={status.state}
                progresoDelMes={progresoDelMes}
              />
            </button>
          );
        })}
      </div>

      {editing && (
        <BudgetAmountSheet
          category={editing}
          currentAmount={budgetByCategory.get(editing.id)?.amount ?? 0}
          onSave={handleSaveBudget}
          onCancel={() => setEditing(null)}
        />
      )}
    </Screen>
  );
}
