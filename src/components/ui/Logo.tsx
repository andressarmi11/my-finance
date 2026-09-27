import { useId } from 'react';

/**
 * The brand: three steps going up. It's literal ("Step up") and at the
 * same time the bar chart of any money app — the same drawing
 * says "staircase" and says "this grows", which is exactly what the app promises.
 *
 * The first two steps use the pay-period blue and the last one the
 * orange: those are the SAME two colors the app already uses to tell the
 * 10th's pay period apart from the 25th's (see tokens.css), so the brand
 * doesn't debut a new palette, it uses the one the user already learned.
 *
 * It's inline SVG and not a .png: it scales to any size without looking
 * blurry, it follows dark mode on its own (it reads the tokens) and it doesn't
 * add one more file to request over the network. The .png files in public/icons
 * — which ARE needed, because the manifest and iOS don't accept SVG — are
 * generated from this with `node scripts/generar-iconos.mjs`.
 */
export function Logo({ size = 24, tile = false, title }: {
  size?: number;
  /** "App icon" version: the steps cut out over a blue square. */
  tile?: boolean;
  /** If it's shown alongside the "Step up" text, leave it empty: it's decorative. */
  title?: string;
}) {
  const gid = useId();
  const a11y = title
    ? ({ role: 'img' as const, 'aria-label': title })
    : ({ 'aria-hidden': true as const, focusable: 'false' as const });

  // Three bars of equal width and increasing height (+5 each), resting on
  // the same floor line. The constant jump is what reads as a step;
  // if the heights were arbitrary it would just be any old chart.
  const steps = (colors: [string, string, string]) => (
    <>
      <rect x="2"  y="13" width="6" height="8"  rx="2" fill={colors[0]} />
      <rect x="9"  y="8"  width="6" height="13" rx="2" fill={colors[1]} />
      <rect x="16" y="3"  width="6" height="18" rx="2" fill={colors[2]} />
    </>
  );

  if (!tile) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...a11y}>
        {steps(['var(--q10)', 'var(--q10)', 'var(--q25)'])}
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" {...a11y}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0A84FF" />
          <stop offset="1" stopColor="#0051D5" />
        </linearGradient>
      </defs>
      {/* rx 14 of 64 ≈ the rounding of an iOS icon */}
      <rect width="64" height="64" rx="14" fill={`url(#${gid})`} />
      {/* The 24 glyph, centered and scaled 1.6, leaves the breathing room Apple asks for. */}
      <g transform="translate(12.8 12.8) scale(1.6)">
        {steps(['#FFFFFF', '#FFFFFF', '#FFB340'])}
      </g>
    </svg>
  );
}
