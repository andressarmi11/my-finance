/**
 * Tombstones in the cloud. Kept separate from supabaseRepository on
 * purpose: it's an operation that only makes sense while syncing, and
 * putting it in the Repository interface would force LocalRepository to
 * implement something it doesn't use.
 */
import { getSupabase } from './client';
import type { DeletableEntity, Tombstone } from '../sync/tombstones';
import { translate } from '@/i18n/language';

interface DeletionRow {
  user_id: string;
  id: string;
  entity: string;
  entity_id: string;
  deleted_at: string;
}

async function currentUserId(): Promise<string> {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error(translate('supabase.noActiveSession'));
  return session.user.id;
}

export async function listRemoteTombstones(): Promise<Tombstone[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('deletions').select('*');
  if (error) throw error;
  return (data as DeletionRow[]).map((r) => ({
    id: r.id, entity: r.entity as DeletableEntity, entityId: r.entity_id, deletedAt: r.deleted_at,
  }));
}

export async function saveRemoteTombstones(tombstones: Tombstone[]): Promise<void> {
  if (tombstones.length === 0) return;
  const [supabase, userId] = await Promise.all([getSupabase(), currentUserId()]);
  const rows: DeletionRow[] = tombstones.map((t) => ({
    user_id: userId, id: t.id, entity: t.entity, entity_id: t.entityId, deleted_at: t.deletedAt,
  }));
  const { error } = await supabase.from('deletions').upsert(rows);
  if (error) throw error;
}

/** Actually deletes the rows that have a tombstone. */
export async function applyRemoteDeletions(tombstones: Tombstone[]): Promise<void> {
  if (tombstones.length === 0) return;
  const supabase = await getSupabase();
  const tableFor: Record<DeletableEntity, string> = {
    transactions: 'transactions',
    categories: 'categories',
    paymentMethods: 'payment_methods',
    recurringRules: 'recurring_rules',
  };

  const byEntity = new Map<DeletableEntity, string[]>();
  for (const t of tombstones) {
    const list = byEntity.get(t.entity) ?? [];
    list.push(t.entityId);
    byEntity.set(t.entity, list);
  }

  for (const [entity, ids] of byEntity) {
    const { error } = await supabase.from(tableFor[entity]).delete().in('id', ids);
    if (error) throw error;
  }
}
