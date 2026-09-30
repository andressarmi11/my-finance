// Pure pieces of send-reminders: the limits, the time window and the
// notification text. No Deno, no npm: imports, no network, so vitest can run
// them (policy.test.ts) and a change to a limit is a reviewed diff, not a
// value hidden in the middle of the handler.

/**
 * Hard caps, for cost safety. Edge Functions are billed per invocation and
 * by wall-clock time, and push services can hang: none of these may depend
 * on how much data there is.
 */
export const LIMITS = {
  /** Reminders read per run. Whatever is left waits for the next tick (10 min). */
  batchSize: 500,
  /** Ids per claim/update/select: keeps every PostgREST URL short. */
  chunkSize: 100,
  /** Each push request is abandoned after this long. */
  pushTimeoutMs: 10_000,
  /** Pushes in flight at once. */
  pushConcurrency: 10,
  /**
   * After this long the run stops claiming new chunks (the ones already
   * claimed finish). Well under the platform's wall-clock limit: an
   * unclaimed reminder is simply picked up by the next run.
   */
  runBudgetMs: 60_000,
  /**
   * A reminder more than this late is not sent at all: "tu pago de ayer"
   * a day later is noise. Also covers missed runs (an outage, a cron hiccup)
   * without ever reaching further back.
   */
  maxLatenessMs: 24 * 60 * 60_000,
} as const;

/**
 * Which remind_at values are due in this run: (now − maxLateness, now].
 *
 * The window since the previous run is (previous run, now]; that's this one,
 * because every reminder sent is taken out of 'scheduled' first (see
 * claimableFilter), so whatever an earlier run handled can't match again —
 * and whatever it missed (batch cap, run budget, outage) is still caught,
 * up to maxLateness.
 */
export function dueWindow(now: Date, maxLatenessMs: number = LIMITS.maxLatenessMs): { from: string; to: string } {
  return { from: new Date(now.getTime() - maxLatenessMs).toISOString(), to: now.toISOString() };
}

/**
 * The only state a reminder may be sent from. The claim is a conditional
 * update ("set sent where status = scheduled"): two overlapping runs can
 * both read a reminder, but only one gets it back from the update, so it
 * is never sent twice. At most once, on purpose: if the run dies after the
 * claim, that reminder is lost rather than repeated.
 */
export const CLAIMABLE_STATUS = 'scheduled';

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error(`chunk size must be a positive integer, got ${size}`);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Runs fn over items with at most `limit` in flight; results keep the input order. */
export async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}

/** True once the run has used its time budget. */
export function outOfTime(startedAt: number, now: number, budgetMs: number = LIMITS.runBudgetMs): boolean {
  return now - startedAt >= budgetMs;
}

/** The push body. Same text as before v2; the amount in Colombian format. */
export function reminderPayload(transaction: { concept: string; amount: number } | null): { title: string; body: string } {
  return {
    title: 'Step up',
    body: transaction
      ? `Recuerda: ${transaction.concept} — $${Number(transaction.amount).toLocaleString('es-CO')}`
      : 'Tienes un pago próximo.',
  };
}
