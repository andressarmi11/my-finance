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
import { budgetFromRow, budgetToRow, type BudgetRow } from './mappers';
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
  const { data, error } = await supabase.from('budgets').select('*');
  if (error) throw error;
  return (data as BudgetRow[]).map(budgetFromRow);
}

export async function saveRemoteBudgets(budgets: Budget[]): Promise<void> {
  if (budgets.length === 0) return;
  const [supabase, userId] = await Promise.all([getSupabase(), currentUserId()]);
  // In a single upsert: there are few rows (one per category and month)
  // and this way sync doesn't make one request per budget.
  const { error } = await supabase
    .from('budgets')
    .upsert(budgets.map((b) => budgetToRow(userId, b)));
  if (error) throw error;
}
