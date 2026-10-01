/**
 * Syncing savings plans: last write wins by id, both ways. Few rows (one
 * active plan at most), so the whole list each time. Runs after budgets:
 * the plan's budgets travel with the budgets' own sync.
 */
import { db } from '../db';
import { getSupabase } from '../supabase/client';
import { listRemoteSavingsPlans, saveRemoteSavingsPlans } from '../supabase/savingsPlans';
import { newest as newer } from './newest';

export async function syncSavingsPlans(): Promise<{ pulled: number; pushed: number }> {
  const remote = await listRemoteSavingsPlans();
  if (remote === null) {
    console.warn('Sync: falta la tabla savings_plans (migración 0020); el plan de ahorro queda solo en este dispositivo.');
    return { pulled: 0, pushed: 0 };
  }
  const local = await db.savingsPlans.toArray();
  const localById = new Map(local.map((p) => [p.id, p]));
  const remoteById = new Map(remote.map((p) => [p.id, p]));

  const pull = remote.filter((r) => { const l = localById.get(r.id); return !l || newer(r.updatedAt, l.updatedAt); });
  if (pull.length > 0) await db.savingsPlans.bulkPut(pull);

  const push = local.filter((l) => { const r = remoteById.get(l.id); return !r || newer(l.updatedAt, r.updatedAt); });
  if (push.length > 0) {
    const supabase = await getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await saveRemoteSavingsPlans(session.user.id, push);
  }
  return { pulled: pull.length, pushed: push.length };
}
