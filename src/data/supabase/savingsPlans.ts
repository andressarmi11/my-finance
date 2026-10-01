/**
 * Savings plans in the cloud (migration 0020). One row per plan, the plan
 * itself in `data`; deleted plans stay as rows with deleted_at, so a
 * deletion travels like any edit (last write wins).
 *
 * A server without migration 0020 has no table: sync skips plans (they
 * stay on this device) instead of failing the whole cycle.
 */
import { getSupabase } from './client';
import type { SavingsPlan } from '@/domain/types';

export interface SavingsPlanRow {
  id: string;
  user_id: string;
  data: Omit<SavingsPlan, 'id' | 'updatedAt' | 'deletedAt'>;
  deleted_at: string | null;
  updated_at: string;
}

export function savingsPlanToRow(userId: string, p: SavingsPlan): SavingsPlanRow {
  const { id, updatedAt, deletedAt, ...data } = p;
  return { id, user_id: userId, data, deleted_at: deletedAt ?? null, updated_at: updatedAt || new Date().toISOString() };
}

export function savingsPlanFromRow(row: SavingsPlanRow): SavingsPlan {
  const plan: SavingsPlan = { ...row.data, id: row.id, updatedAt: row.updated_at };
  if (row.deleted_at) plan.deletedAt = row.deleted_at;
  return plan;
}

/** The table isn't there (migration 0020 not run). */
export function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /savings_plans/.test(error.message ?? '') && /exist|find|schema cache/i.test(error.message ?? '');
}

/** null = the server has no plans table yet. */
export async function listRemoteSavingsPlans(): Promise<SavingsPlan[] | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('savings_plans').select('*');
  if (missingTable(error)) return null;
  if (error) throw error;
  return (data as SavingsPlanRow[]).map(savingsPlanFromRow);
}

export async function saveRemoteSavingsPlans(userId: string, plans: SavingsPlan[]): Promise<void> {
  if (plans.length === 0) return;
  const supabase = await getSupabase();
  const { error } = await supabase.from('savings_plans').upsert(plans.map((p) => savingsPlanToRow(userId, p)));
  if (error && !missingTable(error)) throw error;
}
