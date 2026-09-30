/**
 * "704K", "1,2M", "8,3 M"-style abbreviations for tight spots (budget
 * columns, card summaries). No currency symbol: the context carries it.
 */
export function shortAmount(n: number): string {
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(Math.round(n));
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}${(m >= 10 ? Math.round(m) : Math.round(m * 10) / 10).toString().replace('.', ',')}M`;
  }
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}K`;
  return `${sign}${abs}`;
}
