import type { CSSProperties } from 'react';
import { currencySymbol, formatMoney } from '@/domain/money/format';
import { AnimatedNumber } from '@/features/dashboard/AnimatedNumber';

/**
 * The one big number of a screen (redesign §0): the figure large, the
 * currency symbol smaller and grey beside it, and the sign — when there is
 * one — in front of the symbol. The symbol goes after the number for
 * currencies that write it that way ("2.500 €").
 */
export function BigAmount({ value, size, signed = false, color, accent, animate = true, style }: {
  value: number;
  /** Font size of the figure, in px. The symbol takes a bit over half. */
  size: number;
  /** Always show the sign (+/−), not only when negative. */
  signed?: boolean;
  color?: string;
  /** Colour of the sign and the symbol, with the figure in `color` (Análisis: "+$" green, number white). */
  accent?: string;
  animate?: boolean;
  style?: CSSProperties;
}) {
  const symbol = currencySymbol();
  const suffix = formatMoney(1).endsWith(symbol);
  const figure = (n: number) => formatMoney(Math.abs(n)).replace(symbol, '').trim();
  const sign = value < 0 ? '−' : signed && value > 0 ? '+' : '';
  // The symbol hangs from the top of the figure, like a superscript
  // (prototype: 30px with 8px on top beside a 56px figure).
  const symbolStyle: CSSProperties = {
    fontSize: Math.round(size * 0.54),
    fontWeight: 700,
    lineHeight: 'normal',
    letterSpacing: '-0.035rem',
    color: accent ?? 'var(--text-muted)',
    margin: suffix ? `${Math.round(size * 0.14)}px 0 0 4px` : `${Math.round(size * 0.14)}px 4px 0 0`,
  };
  const numberStyle: CSSProperties = {
    fontSize: size,
    fontWeight: 700,
    letterSpacing: '-0.035em',
    lineHeight: 1,
    color: color ?? 'var(--text)',
  };
  return (
    <span
      className="figures"
      style={{ display: 'inline-flex', alignItems: 'flex-start', justifyContent: 'center', ...style }}
    >
      {sign && (accent
        // "+$" as one piece, like the prototype.
        ? <span style={{ ...symbolStyle, margin: `${Math.round(size * 0.14)}px 0 0` }}>{sign}</span>
        : <span style={{ ...numberStyle, fontSize: Math.round(size * 0.7), marginRight: 2 }}>{sign}</span>)}
      {!suffix && <span style={symbolStyle}>{symbol}</span>}
      {animate
        ? <AnimatedNumber value={value} format={figure} style={numberStyle} />
        : <span style={numberStyle}>{figure(value)}</span>}
      {suffix && <span style={symbolStyle}>{symbol}</span>}
    </span>
  );
}
