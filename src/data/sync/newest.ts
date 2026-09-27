/**
 * Which of two timestamps wins in a last-write-wins.
 *
 * Kept separate so syncService and each entity's reconciliation rules can
 * share it without importing each other.
 */
export function newest(a: string, b: string): boolean {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  // An empty or invalid date never wins: that's what the cloud returns
  // when there's no row yet, and what a local row that was never saved has.
  if (Number.isNaN(ta)) return false;
  if (Number.isNaN(tb)) return true;
  return ta > tb;
}
