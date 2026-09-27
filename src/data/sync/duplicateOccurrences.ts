/**
 * A recurring occurrence with TWO ids is the same occurrence.
 *
 * The bug this fixes, seen in production:
 *
 *   transactions.bulkPut(): 13 of 150 operations failed.
 *   ConstraintError: Unable to add key to index '[recurringRuleId+periodKey]'
 *
 * Until 2026-09-18 (commit 7c68272) recurring instances were born with
 * crypto.randomUUID(). Since then their id IS their identity:
 * `${ruleId}:${periodKey}` (see occurrenceId in data/local/materialize.ts).
 * The old rows are still in Postgres with the random id, and locally
 * materialize has already created the same occurrence with the
 * deterministic id.
 *
 * On pull, both want the same pair (recurringRuleId, periodKey), which in
 * Dexie is a UNIQUE index. The remote row violates it, bulkPut throws, and
 * since that call is at the end of the pull, THE ENTIRE SYNC CYCLE DIES:
 * nothing gets uploaded and the error comes back on every retry.
 *
 * Postgres never had both: its unique constraint is
 * (user_id, recurring_rule_id, period_key) and would have rejected the
 * second one. Over there ONLY the old one survived, and here ONLY the new
 * one did. The collision only shows up when they're brought together on
 * pull — and since push runs afterward, the version with the
 * deterministic id never got a chance to upload and resolve it on its own.
 *
 * That's why the fix isn't just picking one: the other one has to be
 * DELETED with a tombstone, so the deletion travels and both sides
 * converge on the same id.
 *
 * This function is pure so it can be tested without IndexedDB or the network.
 */
import { newest } from './newest';
import type { Transaction } from '@/domain/types';

export interface OccurrencesPlan {
  /** The rows that are allowed in, with no repeated pairs left. */
  toSave: Transaction[];
  /** Ids that need to be deleted (with a tombstone): the other half of a duplicate. */
  toDelete: string[];
}

/** The pair identifies the occurrence. No pair, no occurrence. */
function par(tx: Transaction): string | null {
  if (!tx.recurringRuleId || !tx.periodKey) return null;
  return `${tx.recurringRuleId}|${tx.periodKey}`;
}

/**
 * The id materialize.ts is going to keep recreating. It always wins, even
 * if the newer content comes from the other row: if we kept the random
 * one, the next start-up would create the deterministic one again and
 * collide.
 */
function deterministicId(tx: Transaction): string {
  return `${tx.recurringRuleId}:${tx.periodKey}`;
}

export function reconcileOccurrences(
  remotas: Transaction[],
  localRows: Transaction[],
): OccurrencesPlan {
  // The ones that aren't occurrences pass straight through: they're the
  // vast majority and have no way to collide (their pair has undefined
  // and isn't indexed).
  const toSave: Transaction[] = [];
  const byPair = new Map<string, Transaction>();
  const seenIds = new Map<string, Set<string>>();

  const registrar = (tx: Transaction) => {
    const key = par(tx);
    if (key === null) return false;
    const ids = seenIds.get(key) ?? new Set<string>();
    ids.add(tx.id);
    seenIds.set(key, ids);
    const earlier = byPair.get(key);
    if (!earlier || newest(tx.updatedAt, earlier.updatedAt)) byPair.set(key, tx);
    return true;
  };

  for (const tx of remotas) {
    if (!registrar(tx)) toSave.push(tx);
  }
  // Local rows only contribute their id to the duplicate count and their
  // content to the fight over which is newer. They aren't re-saved if
  // they win: they're already there.
  const remotePairs = new Set([...byPair.keys()]);
  for (const tx of localRows) {
    const key = par(tx);
    if (key !== null && remotePairs.has(key)) registrar(tx);
  }

  const toDelete: string[] = [];
  for (const [key, ganadora] of byPair) {
    const canonical = deterministicId(ganadora);
    // The newest content, but always under the deterministic id.
    toSave.push(ganadora.id === canonical ? ganadora : { ...ganadora, id: canonical });
    for (const id of seenIds.get(key) ?? []) {
      if (id !== canonical) toDelete.push(id);
    }
  }

  return { toSave, toDelete };
}
