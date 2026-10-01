/**
 * Budgets in the cloud, for syncing.
 *
 * Kept separate from supabaseRepository for the same reason as
 * deletions.ts: the Repository interface exposes listBudgets(year, month),
 * which is what the SCREEN needs, but syncing needs all of them. Putting
 * a "listAllBudgets" in the interface would force LocalRepository to
 * implement something no screen uses.
 */
import { getSupabase } from './client';
import { selectAll } from './supabaseRepository';
import { budgetFromRow, budgetRowWithoutKind, budgetToRow, type BudgetRow } from './mappers';
import type { Budget } from '@/domain/types';
import { translate } from '@/i18n/language';

async function currentUserId(): Promise<string> {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error(translate('supabase.noActiveSession'));
  return session.user.id;
}

export async function listRemoteBudgets(): Promise<Budget[]> {
  const supabase = await getSupabase();
  const data = await selectAll<BudgetRow>((from, to) =>
    supabase.from('budgets').select('*').order('id').range(from, to));
  return data.map(budgetFromRow);
}

export async function saveRemoteBudgets(budgets: Budget[]): Promise<void> {
  if (budgets.length === 0) return;
  const [supabase, userId] = await Promise.all([getSupabase(), currentUserId()]);
  // In a single upsert: there are few rows (one per category and month)
  // and this way sync doesn't make one request per budget.
  const rows = budgets.map((b) => budgetToRow(userId, b));
  const { error } = await supabase.from('budgets').upsert(rows);
  if (!error) return;
  // Migration 0019 not run yet: PostgREST doesn't know the kind columns.
  // Upload what the server understands rather than stopping the whole sync;
  // Tope/Meta stays on this device until the migration is in.
  if (missingColumn(error)) {
    console.warn('Sync: la tabla budgets no tiene las columnas de la migración 0019; se sube sin Tope/Meta.');
    const retry = await supabase.from('budgets').upsert(rows.map(budgetRowWithoutKind));
    if (retry.error) throw retry.error;
    return;
  }
  throw error;
}

function missingColumn(error: { code?: string; message?: string }): boolean {
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  const message = error.message ?? '';
  return /column/i.test(message) && /kind|plan_id|goal_/.test(message);
}
