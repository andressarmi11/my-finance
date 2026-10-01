/**
 * Budgets across several months at once. A budget is (category, year, month);
 * "delete" is saving amount 0, which travels through the normal budget sync
 * (natural-key last-write-wins) with no tombstone and no migration.
 */
import type { Budget, BudgetKind, Id } from '@/domain/types';
import { planBudgetSet, type YearMonth } from '@/domain/budget/months';
import { nowISO } from '@/lib/todayISO';
import { db } from '../db';
import { requestSyncSoon } from '../sync/useCloudSync';

async function existingFor(categoryId: Id, months: YearMonth[]): Promise<Map<string, Budget>> {
  const rows = await db.budgets.where('categoryId').equals(categoryId).toArray();
  const wanted = new Set(months.map((m) => `${m.year}|${m.month}`));
  return new Map(rows.filter((b) => wanted.has(`${b.year}|${b.month}`)).map((b) => [`${b.year}|${b.month}`, b]));
}

export async function listCategoryBudgets(categoryId: Id, months: YearMonth[]): Promise<Budget[]> {
  const found = await existingFor(categoryId, months);
  return [...found.values()].filter((b) => b.amount > 0);
}

export async function setBudgetForMonths(
  categoryId: Id,
  months: YearMonth[],
  amountPerMonth: number,
  /** For months without a live budget (a live one keeps its kind). */
  kindForNew?: BudgetKind,
): Promise<{ saved: number; replaced: number }> {
  if (!Number.isFinite(amountPerMonth) || amountPerMonth < 0) throw new RangeError('amountPerMonth must be >= 0');
  // 0 = delete: don't create rows that only say "nothing".
  if (amountPerMonth === 0) return { saved: 0, replaced: await deleteBudgetForMonths(categoryId, months) };
  const found = await existingFor(categoryId, months);
  const { rows, replaced } = planBudgetSet([...found.values()], categoryId, months, amountPerMonth, nowISO(), () => crypto.randomUUID(), kindForNew);
  await db.budgets.bulkPut(rows);
  requestSyncSoon();
  return { saved: rows.length, replaced };
}

export async function deleteBudgetForMonths(categoryId: Id, months: YearMonth[]): Promise<number> {
  const found = await existingFor(categoryId, months);
  const live = [...found.values()].filter((b) => b.amount > 0);
  if (live.length === 0) return 0;
  const now = nowISO();
  await db.budgets.bulkPut(live.map((b) => ({ ...b, amount: 0, updatedAt: now })));
  requestSyncSoon();
  return live.length;
}

/**
 * Tope | Meta on the Budgets screen: the month being viewed and the months
 * after it that already have a budget in this category. Past months keep
 * what they were (they're history).
 */
export async function setBudgetKind(categoryId: Id, from: YearMonth, kind: BudgetKind): Promise<number> {
  const start = from.year * 12 + from.month;
  const rows = (await db.budgets.where('categoryId').equals(categoryId).toArray())
    .filter((b) => b.amount > 0 && b.year * 12 + b.month >= start && (b.kind ?? 'limit') !== kind);
  if (rows.length === 0) return 0;
  const now = nowISO();
  await db.budgets.bulkPut(rows.map((b) => ({ ...b, kind, updatedAt: now })));
  requestSyncSoon();
  return rows.length;
}
