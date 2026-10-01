/**
 * The savings plan on this device (PRESUPUESTOS-Y-AHORRO.md, part B).
 *
 * At most one active plan: not deleted and not closed. Saving it writes
 * its budgets (domain/savings/apply.ts) in the same transaction, so the
 * plan and its budgets never disagree; deleting or ending it restores the
 * snapshot. Both travel through sync like any other edit.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { applyPlan, removePlan } from '@/domain/savings/apply';
import { addDays, parseISO, toISO } from '@/domain/dates';
import type { SavingsPlan } from '@/domain/types';
import { nowISO } from '@/lib/todayISO';
import { db } from '../db';
import { requestSyncSoon } from '../sync/useCloudSync';

export function isActivePlan(p: SavingsPlan): boolean {
  return !p.deletedAt && !p.closedAt;
}

export async function getActivePlan(): Promise<SavingsPlan | null> {
  const plans = (await db.savingsPlans.toArray()).filter(isActivePlan);
  // Two devices could each create one offline: the newest wins.
  plans.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return plans[0] ?? null;
}

/** The active plan, live. undefined while loading, null when there's none. */
export function useActivePlan(): SavingsPlan | null | undefined {
  return useLiveQuery(() => getActivePlan(), []);
}

export type PlanDraft = Omit<SavingsPlan, 'id' | 'prevBudgets' | 'createdAt' | 'updatedAt' | 'closedAt' | 'deletedAt'>;

/** Creates the plan, or updates the active one (keeping its original snapshot). */
export async function savePlan(draft: PlanDraft): Promise<SavingsPlan> {
  const now = nowISO();
  const saved = await db.transaction('rw', db.savingsPlans, db.budgets, async () => {
    const current = await getActivePlan();
    const base: SavingsPlan = current
      ? { ...current, ...draft, updatedAt: now }
      : { ...draft, id: crypto.randomUUID(), prevBudgets: [], createdAt: now, updatedAt: now };
    if (base.goalName === undefined) delete base.goalName;
    if (base.goalAmount === undefined) delete base.goalAmount;
    const { rows, prevBudgets } = applyPlan(base, await db.budgets.toArray(), now, () => crypto.randomUUID());
    const plan = { ...base, prevBudgets };
    await db.budgets.bulkPut(rows);
    await db.savingsPlans.put(plan);
    return plan;
  });
  requestSyncSoon();
  return saved;
}

async function takeBack(plan: SavingsPlan, mark: Partial<SavingsPlan>): Promise<void> {
  const now = nowISO();
  await db.transaction('rw', db.savingsPlans, db.budgets, async () => {
    await db.budgets.bulkPut(removePlan(plan, await db.budgets.toArray(), now));
    await db.savingsPlans.put({ ...plan, ...mark, updatedAt: now });
  });
  requestSyncSoon();
}

/** "Eliminar plan": budgets back to how they were; movements untouched. */
export async function deletePlan(plan: SavingsPlan): Promise<void> {
  await takeBack(plan, { deletedAt: nowISO() });
}

/** The end notice's "Terminar": same as deleting, but it stays as history. */
export async function endPlan(plan: SavingsPlan): Promise<void> {
  await takeBack(plan, { closedAt: nowISO() });
}

/** The end notice's "Renovar": the same plan again, from the day after it ended, for as long. */
export async function renewPlan(plan: SavingsPlan): Promise<SavingsPlan> {
  const days = daysBetween(plan.startDate, plan.endDate);
  const startDate = toISO(addDays(parseISO(plan.endDate), 1));
  const endDate = toISO(addDays(parseISO(startDate), days));
  // Same plan (same id and snapshot): savePlan updates the active one.
  return savePlan({ ...draftOf(plan), startDate, endDate });
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.UTC(...ymd(b)) - Date.UTC(...ymd(a))) / 86_400_000);
}
function ymd(iso: string): [number, number, number] {
  const { y, m, d } = parseISO(iso);
  return [y, m - 1, d];
}

/** The editable part of a plan. */
export function draftOf(plan: SavingsPlan): PlanDraft {
  return {
    mode: plan.mode, intensity: plan.intensity, locked: plan.locked, unit: plan.unit, n: plan.n,
    untilGoal: plan.untilGoal, startDate: plan.startDate, endDate: plan.endDate, monthlyTarget: plan.monthlyTarget,
    requestedMonthly: plan.requestedMonthly, goalName: plan.goalName, goalAmount: plan.goalAmount,
    cuts: plan.cuts, goalCategoryId: plan.goalCategoryId, goalMonthly: plan.goalMonthly,
  };
}
