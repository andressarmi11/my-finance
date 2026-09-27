/**
 * "What day is it today", for prefilling forms. It deliberately uses the
 * device's LOCAL time (it is literally the user's today) — unlike
 * domain/dates.ts, which must never depend on a time zone because it works
 * out cycles and pay periods from a date it's already given.
 */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}
