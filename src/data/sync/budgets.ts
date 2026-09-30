/**
 * Reconciling budgets from both sides.
 *
 * It has its own rules, different from the rest of the entities, because
 * of something the schema itself says: the Postgres table declares
 * `unique (user_id, category_id, year, month)`. That means a budget's
 * identity is NOT its id, but which category and which month it's for.
 *
 * That matters because ids are generated on the device. Two phones that
 * set a budget for "Hogar" in September without having synced before
 * generate two different ids for the SAME row; uploading the second one
 * by id wouldn't create another row, it would collide with that unique
 * constraint and the entire sync would fail with a Postgres error.
 *
 * That's why they're paired by natural key and the newest one wins, but
 * the id that survives is always the cloud's: it's the only one both
 * devices can agree on.
 *
 * There are no tombstones: deleting a budget is saving amount 0, which
 * travels as a normal edit (newest wins) and is hidden by listBudgets.
 */
import type { Budget } from '@/domain/types';
import { newest } from './newest';

/** A budget's real identity, according to Postgres's unique constraint. */
export function budgetKey(b: Pick<Budget, 'categoryId' | 'year' | 'month'>): string {
  return `${b.categoryId}|${b.year}|${b.month}`;
}

export interface BudgetsPlan {
  /** Rows to write into Dexie. */
  saveLocal: Budget[];
  /** Rows to upload to Supabase. */
  subir: Budget[];
  /** Local ids that were orphaned by adopting the cloud's id. */
  deleteLocal: string[];
}

export function reconcileBudgets(localRows: Budget[], remoteRows: Budget[]): BudgetsPlan {
  const byRemoteKey = new Map(remoteRows.map((b) => [budgetKey(b), b]));
  const byLocalKey = new Map(localRows.map((b) => [budgetKey(b), b]));

  const plan: BudgetsPlan = { saveLocal: [], subir: [], deleteLocal: [] };

  for (const [key, remoteRow] of byRemoteKey) {
    const local = byLocalKey.get(key);

    if (!local) {
      plan.saveLocal.push(remoteRow);
      continue;
    }

    if (newest(remoteRow.updatedAt, local.updatedAt)) {
      plan.saveLocal.push(remoteRow);
      // The local one loses; if it also had a different id, its row is now extra.
      if (local.id !== remoteRow.id) plan.deleteLocal.push(local.id);
      continue;
    }

    // Same stamp: it's the same edit on both sides (this device uploaded it,
    // or pulled it). Uploading it again on every sync re-sent every budget
    // and reported them as "uploaded". Only the id may still need adopting.
    if (!newest(local.updatedAt, remoteRow.updatedAt)) {
      if (local.id !== remoteRow.id) {
        plan.saveLocal.push(remoteRow);
        plan.deleteLocal.push(local.id);
      }
      continue;
    }

    // The local one wins, but it travels with the cloud's id: uploading
    // it with its own would blow up against
    // unique(user_id, category_id, year, month).
    const winner: Budget = { ...local, id: remoteRow.id };
    plan.subir.push(winner);
    if (local.id !== remoteRow.id) {
      plan.saveLocal.push(winner);
      plan.deleteLocal.push(local.id);
    }
  }

  // What only exists here has never traveled yet.
  for (const [key, local] of byLocalKey) {
    if (!byRemoteKey.has(key)) plan.subir.push(local);
  }

  return plan;
}
