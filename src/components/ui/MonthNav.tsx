import { IconArrowBackUp, IconArrowForwardUp, IconLoader2 } from '@tabler/icons-react';
import { useT } from '@/i18n/language';
import { haptic } from '@/lib/haptic';

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Module state, same as setMoneyLocale: monthName is called from headers,
 * charts and period labels, and threading the language through all those
 * signatures would be noise. The language provider sets it.
 */
let MONTH_NAMES = MONTHS_ES;

export function setMonthNames(language: 'es' | 'en'): void {
  MONTH_NAMES = language === 'en' ? MONTHS_EN : MONTHS_ES;
}

/**
 * How long a load has to take before it shows. A period that's ready at
 * once swaps without a flash; a slow one shows "Loading…" and dimmed arrows.
 */
const BUSY_DELAY_MS = 150;

/** Month name, 1-12. Returns '' out of range rather than undefined. */
export function monthName(m: number): string {
  return MONTH_NAMES[m - 1] ?? '';
}

/**
 * The widest label this navigator can ever show, used to reserve width.
 *
 * It looks at BOTH languages on purpose, not just the active one: otherwise
 * the layout would still jump when someone switches language, and the whole
 * point is that nothing under the user's thumb ever moves.
 */
export function widestMonthLabel(short = false): string {
  const candidates = [...MONTHS_ES, ...MONTHS_EN].map((m) => (short ? m.slice(0, 3) : m));
  const longest = candidates.reduce((a, b) => (b.length > a.length ? b : a));
  return `${longest} 0000`;
}

/**
 * Every translation of "Today", so the button can reserve the width of the
 * longest one. Keep in sync with the `nav.hoy` key in the dictionary — a
 * third language added there and forgotten here only costs a small shift,
 * not a break.
 */
const TODAY_IN_EVERY_LANGUAGE = ['Hoy', 'Today'];

/**
 * Month navigator: ‹ September 2026 › plus a Today button once you drift
 * away from the current month. Used by Home, Transactions and Calendar.
 *
 * It exists because materialize.ts creates recurring instances up to 95
 * days ahead: with no month window, lists mixed December with today and,
 * sorted descending, showed the future first. Bounding to a month fixes the
 * order and lets you look at past months too.
 *
 * The Today button is EXPLICIT, not the label. Going back to the current
 * month used to mean tapping the label, which only changed colour once you
 * drifted: the feature existed but nobody could guess it, and after paging
 * forward a year, getting back was a punishment. An invisible affordance is
 * the same as no affordance.
 */
export function MonthNav({
  label, widthSample, onPrev, onNext, onToday, todayIsAhead, unit = 'month', centered = false, busy = false, compact = false,
}: {
  label: string;
  /**
   * What one step is, for screen readers. Analytics pages by quincena,
   * quarter or year too, and "Previous month" on a quarter is a lie.
   */
  unit?: 'month' | 'period';
  /**
   * The longest label this caller can produce. The label box reserves that
   * width so the arrows never move.
   *
   * Without it the arrows slid sideways as the month name grew or shrank
   * ("Mayo" vs "Septiembre"), so paging through months kept moving the
   * arrow out from under your thumb — and onto Today by accident.
   */
  widthSample: string;
  onPrev: () => void;
  onNext: () => void;
  /** undefined = you are already on the current month; Today is hidden. */
  onToday?: () => void;
  /**
   * Whether today lies FORWARD from where you are. It decides which way
   * the arrow on the Today button points: back when you have paged into
   * the future, forward when you have paged into the past. In `centered`
   * mode it also decides the side the button sits on.
   */
  todayIsAhead?: boolean;
  /**
   * Arrows and label dead-centre across the full width, with Today in a side
   * column: left after paging back, right after paging forward. The side
   * columns are equal, so the arrows never move when Today comes and goes.
   * Off by default: Home keeps it compact beside its title.
   */
  centered?: boolean;
  /**
   * The screen is still building the period just asked for. The arrows wait
   * — a second tap would queue work on top of work — and the label says so,
   * instead of a delay the user can't explain.
   */
  busy?: boolean;
  /**
   * Redesign §3/§4: the arrows and the label inside a 34px `--surface` pill,
   * for headers where the navigator sits beside a title or the logo.
   */
  compact?: boolean;
}) {
  const t = useT();
  const loadingText = t('home.loading');

  const todayButton = (
    <button
      type="button"
      onClick={() => { if (onToday && !busy) { haptic('light'); onToday(); } }}
      aria-label={unit === 'period' ? t('nav.backToCurrentPeriod') : t('nav.backToCurrentMonth')}
      aria-hidden={!onToday}
      // aria-disabled, not disabled, while busy: disabling the focused button
      // threw keyboard and VoiceOver focus back to the top of the page.
      disabled={!onToday}
      aria-disabled={busy || undefined}
      tabIndex={onToday ? undefined : -1}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        minHeight: 32, margin: centered ? '0 2px' : '0 0 0 2px', padding: '0 9px 0 7px',
        // Centred, the button lives in a side column whose width depends on
        // the phone, the font and the language ("Hoy" vs "Today"). Instead
        // of guessing a breakpoint, the word WRAPS to a second line when it
        // doesn't fit, and that line is clipped: the browser decides, from
        // the real space, whether there's room for the word or only the arrow.
        ...(centered ? {
          height: 32, maxWidth: '100%', minWidth: 0, flexWrap: 'wrap' as const,
          alignContent: 'flex-start', justifyContent: 'center', overflow: 'hidden', paddingRight: 7,
        } : {}),
        borderRadius: 999, border: '1px solid var(--q10)',
        background: 'var(--q10-soft)', color: 'var(--q10-text)',
        fontSize: 'var(--text-sm)', fontWeight: 700,
        cursor: onToday && !busy ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        visibility: onToday ? 'visible' : 'hidden',
        opacity: busy ? 0.5 : 1,
        transition: busy ? `opacity 120ms ease ${BUSY_DELAY_MS}ms` : 'none',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', height: 30 }}>
        {todayIsAhead
          ? <IconArrowForwardUp size={15} stroke={2.2} aria-hidden />
          : <IconArrowBackUp size={15} stroke={2.2} aria-hidden />}
      </span>

      {/* Same stacking trick as the label, for the word itself: "Today"
          is wider than "Hoy", so without this the whole navigator —and
          with it the arrows— shifted the moment someone switched
          language. Both words are laid out hidden in the same grid cell;
          the cell takes the wider of the two, whatever the font says. */}
      <span style={{ display: 'inline-grid', alignItems: 'center', justifyItems: 'center', height: 30, paddingRight: centered ? 2 : 0 }}>
        {/* Not needed when centred: the side column absorbs the width
            change, the arrows don't move — and the saved width is what lets
            the word fit beside them on a 390px phone. */}
        {!centered && TODAY_IN_EVERY_LANGUAGE.map((word) => (
          <span key={word} aria-hidden style={{ gridArea: '1 / 1', visibility: 'hidden' }}>
            {word}
          </span>
        ))}
        <span style={{ gridArea: '1 / 1' }}>{t('nav.today')}</span>
      </span>
    </button>
  );

  const arrowsAndLabel = (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 2,
        ...(compact ? {
          height: 34, padding: '0 2px', borderRadius: 17,
          background: 'var(--surface)', border: '1px solid var(--line)',
        } : {}),
      }}
    >
      <Arrow dir="prev" unit={unit} disabled={busy} onClick={onPrev} compact={compact} />

      {/* Every span shares one grid cell: the hidden ones set the width from
          the longest possible label (and from "Loading…", so swapping to it
          moves nothing), the visible one carries the real text. Measuring
          this way is exact, unlike guessing in `ch` or px, which drifts with
          the font and with the language. */}
      <span
        style={{
          display: 'inline-grid',
          minHeight: compact ? 32 : 'var(--tap)',
          alignItems: 'center',
          justifyItems: 'center',
          padding: '0 4px',
          color: 'var(--text-muted)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        <span aria-hidden style={{ gridArea: '1 / 1', visibility: 'hidden' }}>{widthSample}</span>
        <span aria-hidden style={{ gridArea: '1 / 1', visibility: 'hidden', paddingLeft: 20 }}>{loadingText}</span>
        {/* Announced after each arrow tap: otherwise a screen reader user
            presses "next" and hears nothing about where they landed. The
            label and "Loading…" cross-fade with a short delay, so a period
            that loads at once shows no flash at all. */}
        <span
          aria-live="polite"
          style={{ gridArea: '1 / 1', opacity: busy ? 0 : 1, transition: busy ? `opacity 120ms ease ${BUSY_DELAY_MS}ms` : 'none' }}
        >
          {label}
        </span>
        <span
          aria-hidden
          style={{
            gridArea: '1 / 1', display: 'inline-flex', alignItems: 'center', gap: 6,
            opacity: busy ? 1 : 0, transition: busy ? `opacity 120ms ease ${BUSY_DELAY_MS}ms` : 'none',
          }}
        >
          <IconLoader2 size={14} stroke={2.2} style={{ animation: busy ? 'spin 0.8s linear infinite' : undefined }} />
          {loadingText}
        </span>
      </span>

      <Arrow dir="next" unit={unit} disabled={busy} onClick={onNext} compact={compact} />
    </div>
  );

  if (!centered) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {arrowsAndLabel}
        {/* Always rendered, hidden when there is nowhere to go back to.
            Dropping it from the tree shrank the whole navigator, and since
            the navigator is centred, everything shifted — which is the very
            thing this component now promises never to do. Hidden it still
            reserves its box, and aria-hidden + disabled keep it out of the
            tab order and out of a screen reader. */}
        {todayButton}
      </div>
    );
  }

  // Two equal side columns keep the middle one — arrows and label — on the
  // exact centre at any width. minmax(0, 1fr) lets them shrink on a narrow
  // phone instead of pushing the centre off.
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'center', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>{onToday && todayIsAhead ? todayButton : null}</div>
      {arrowsAndLabel}
      <div style={{ display: 'flex', justifyContent: 'flex-start', minWidth: 0 }}>{onToday && !todayIsAhead ? todayButton : null}</div>
    </div>
  );
}

function Arrow({ dir, unit, disabled = false, onClick, compact = false }: {
  dir: 'prev' | 'next'; unit: 'month' | 'period'; disabled?: boolean; onClick: () => void; compact?: boolean;
}) {
  const t = useT();
  const label = unit === 'period'
    ? (dir === 'prev' ? t('nav.prevPeriod') : t('nav.nextPeriod'))
    : (dir === 'prev' ? t('nav.prevMonth') : t('nav.nextMonth'));
  return (
    <button
      type="button"
      onClick={() => { if (!disabled) { haptic('light'); onClick(); } }}
      aria-label={label}
      // aria-disabled keeps focus on the arrow just pressed; `disabled` threw
      // it to the top of the page on every tap. The click guard above does
      // the actual blocking.
      aria-disabled={disabled || undefined}
      style={{
        width: compact ? 32 : 'var(--tap)', height: compact ? 32 : 'var(--tap)', display: 'grid', placeItems: 'center',
        border: 'none', background: 'none', color: 'var(--q10-text)', fontSize: 20,
        cursor: disabled ? 'default' : 'pointer', borderRadius: 'var(--radius-s)',
        opacity: disabled ? 0.35 : 1,
        transition: disabled ? `opacity 120ms ease ${BUSY_DELAY_MS}ms` : 'none',
      }}
    >
      {dir === 'prev' ? '‹' : '›'}
    </button>
  );
}
