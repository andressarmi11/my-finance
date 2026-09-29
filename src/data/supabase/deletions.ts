/**
 * Tombstones in the cloud. Kept separate from supabaseRepository on
 * purpose: it's an operation that only makes sense while syncing, and
 * putting it in the Repository interface would force LocalRepository to
 * implement something it doesn't use.
 */
import { getSupabase } from './client';
import { selectAll } from './supabaseRepository';
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

/** Tombstones that arrived since `since` (server time); all of them when null. */
export async function listRemoteTombstonesSince(
  since: string | null,
): Promise<{ tombstones: Tombstone[]; maxSyncedAt: string | null }> {
  const supabase = await getSupabase();
  const data = await selectAll<DeletionRow & { synced_at: string }>((from, to) => {
    const query = supabase.from('deletions').select('*');
    return since
      ? query.gt('synced_at', since).order('synced_at').order('id').range(from, to)
      : query.order('id').range(from, to);
  });
  let maxSyncedAt: string | null = null;
  for (const r of data) if (!maxSyncedAt || r.synced_at > maxSyncedAt) maxSyncedAt = r.synced_at;
  return {
    tombstones: data.map((r) => ({
      id: r.id, entity: r.entity as DeletableEntity, entityId: r.entity_id, deletedAt: r.deleted_at,
    })),
    maxSyncedAt,
  };
}

/** Ids of the tombstones the cloud already has: push only sends the rest. */
export async function listRemoteTombstoneIds(): Promise<Set<string>> {
  const supabase = await getSupabase();
  const data = await selectAll<{ id: string }>((from, to) =>
    supabase.from('deletions').select('id').order('id').range(from, to));
  return new Set(data.map((r) => r.id));
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
    // In chunks: the ids travel in the URL, and a long history of
    // deletions made it too long for the server.
    for (let i = 0; i < ids.length; i += 100) {
      const { error } = await supabase.from(tableFor[entity]).delete().in('id', ids.slice(i, i + 100));
      if (error) throw error;
    }
  }
}
