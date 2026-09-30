/**
 * The one segmented control of the redesign (§0): period, Lista/Calendario,
 * Débito/Tarjeta… all look the same. A `--surface` track with 3px of padding
 * and a 12px radius; the active option sits on `--line-strong` with 9px.
 *
 * Buttons with aria-pressed, not a radiogroup: each option acts at once
 * (there's no separate "confirm"), which is what a toggle button announces.
 */
export function Segmented<T extends string>({ options, value, onChange, label, size = 'm', inset = false, labelSize, tall = false }: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group. */
  label: string;
  size?: 's' | 'm';
  /** Inside a sheet (prototype 1a, Débito | Crédito | Efectivo): a --paper
   *  track with no border, 13px labels, the idle ones in --text-faint. */
  inset?: boolean;
  /** The labels' size when it differs from the default (Análisis's period: 13px). */
  labelSize?: number;
  /** 36px options (Cómo te pagan, Recordatorios) instead of 34. */
  tall?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        padding: 3,
        borderRadius: 12,
        background: inset ? 'var(--paper)' : 'var(--surface)',
        border: inset ? 'none' : '1px solid var(--line)',
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            style={{
              minHeight: size === 's' ? 30 : tall ? 36 : 34,
              padding: '0 10px',
              borderRadius: 9,
              border: 'none',
              background: active ? 'var(--line-strong)' : 'transparent',
              color: active ? 'var(--text)' : inset ? 'var(--text-faint)' : 'var(--text-muted)',
              fontSize: labelSize ?? (inset ? 13 : 14),
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background var(--dur-fast) var(--ease-spring-out), color var(--dur-fast) var(--ease-spring-out)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
