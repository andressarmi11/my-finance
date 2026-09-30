/**
 * The brand (1c, "S escalonada"): an S built from five right-angled blocks,
 * so it reads as a staircase and as the initial at the same time, with an
 * amber accent on the top right — the same two colors the app uses to tell
 * the 10th's pay period apart from the 25th's (see tokens.css), so the brand
 * doesn't debut a new palette, it uses the one the user already learned.
 *
 * It's inline SVG and not a .png: it scales to any size without looking
 * blurry, it follows the theme on its own (it reads the tokens) and it doesn't
 * add one more file to request over the network. The .png files in public/icons
 * — which ARE needed, because the manifest and iOS don't accept SVG — are
 * generated from this with `node scripts/generar-iconos.mjs`.
 */
export function Logo({ size = 24, tile = false, title }: {
  size?: number;
  /** "App icon" version: the glyph in white over a solid square. */
  tile?: boolean;
  /** If it's shown alongside the "Step up" text, leave it empty: it's decorative. */
  title?: string;
}) {
  const a11y = title
    ? ({ role: 'img' as const, 'aria-label': title })
    : ({ 'aria-hidden': true as const, focusable: 'false' as const });

  const glyph = (c: string) => (
    <>
      <rect x="3" y="2" width="14" height="5" rx="2" fill={c} />
      <rect x="3" y="2" width="5" height="12" rx="2" fill={c} />
      <rect x="3" y="9.5" width="18" height="5" rx="2" fill={c} />
      <rect x="16" y="9.5" width="5" height="12.5" rx="2" fill={c} />
      <rect x="7" y="17" width="14" height="5" rx="2" fill={c} />
      <rect x="18" y="2" width="3" height="5" rx="1.5" fill="var(--q25)" />
    </>
  );

  if (!tile) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...a11y}>
        {glyph('var(--q10)')}
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" {...a11y}>
      {/* rx 14 of 64 ≈ the rounding of an iOS icon */}
      <rect width="64" height="64" rx="14" fill="var(--brand-tile)" />
      {/* The 24 glyph, centered and scaled 1.6, leaves the breathing room Apple asks for. */}
      <g transform="translate(12.8 12.8) scale(1.6)">
        {glyph('var(--on-brand-tile)')}
      </g>
    </svg>
  );
}
