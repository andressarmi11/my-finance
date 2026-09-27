/**
 * Deletion tombstones.
 *
 * Without this, syncing resurrects what was deleted: if you delete an
 * expense on your phone, the laptop still has it, and on the next
 * "upload" it pushes it right back to the cloud. A deletion has to travel
 * the same way an edit does, and to travel it has to exist as data.
 *
 * Stored by (entity, id) and cleaned up once they've been applied on
 * both sides.
 */
export type DeletableEntity = 'transactions' | 'categories' | 'paymentMethods' | 'recurringRules';

export interface Tombstone {
  /** `${entity}:${entityId}` — primary key, idempotent. */
  id: string;
  entity: DeletableEntity;
  entityId: string;
  deletedAt: string;
}

export function tombstoneId(entity: DeletableEntity, entityId: string): string {
  return `${entity}:${entityId}`;
}

export function makeTombstone(entity: DeletableEntity, entityId: string, deletedAt: string): Tombstone {
  return { id: tombstoneId(entity, entityId), entity, entityId, deletedAt };
}

/** The deleted ids of an entity, to filter out what comes in from the cloud. */
export function deletedIdsOf(tombstones: Tombstone[], entity: DeletableEntity): Set<string> {
  const out = new Set<string>();
  for (const t of tombstones) if (t.entity === entity) out.add(t.entityId);
  return out;
}

/**
 * Merges local tombstones with remote ones, keeping the oldest date for
 * each (the original deletion's date, not the copy's).
 */
export function mergeTombstones(a: Tombstone[], b: Tombstone[]): Tombstone[] {
  const byId = new Map<string, Tombstone>();
  for (const t of [...a, ...b]) {
    const prev = byId.get(t.id);
    if (!prev || t.deletedAt < prev.deletedAt) byId.set(t.id, t);
  }
  return Array.from(byId.values());
}
