import { monthName } from '@/components/ui/MonthNav';

export interface MonthChip {
  key: string;
  month: number; // 1-12
  /** Shown small under the month when the grid spans years (budgets). */
  year?: number;
}

/**
 * 4x3 grid of month toggles. 4 columns of `minmax(0, 1fr)` fit the 280px
 * inner width of a 320px phone (~65px each), which a row of 12 never would.
 * The visible text is short ("Ene"); the accessible name is the full month.
 */
export function MonthChipGrid({ items, selected, onToggle }: {
  items: MonthChip[];
  selected: ReadonlySet<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, marginBottom: 14 }}>
      {items.map((c) => {
        const on = selected.has(c.key);
        const full = monthName(c.month);
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={on}
            aria-label={c.year ? `${full} ${c.year}` : full}
            onClick={() => onToggle(c.key)}
            style={{
              minHeight: 'var(--tap)', borderRadius: 'var(--radius-s)', border: '1px solid var(--line-strong)',
              background: on ? 'var(--text)' : 'var(--surface)', color: on ? 'var(--surface)' : 'var(--text)',
              fontWeight: 600, cursor: 'pointer', fontSize: 13, padding: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.15,
            }}
          >
            {full.slice(0, 3)}
            {c.year && <span aria-hidden style={{ fontSize: 10, fontWeight: 500, opacity: 0.7 }}>{c.year}</span>}
          </button>
        );
      })}
    </div>
  );
}
