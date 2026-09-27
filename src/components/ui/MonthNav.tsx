import { IconArrowBackUp, IconArrowForwardUp } from '@tabler/icons-react';
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
export function MonthNav({ label, widthSample, onPrev, onNext, onToday, todayIsAhead }: {
  label: string;
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
   * Whether today lies FORWARD from where you are. It only decides which
   * way the arrow on the Today button points: back when you have paged into
   * the future, forward when you have paged into the past. Purely visual,
   * but an arrow pointing the wrong way is a small lie.
   */
  todayIsAhead?: boolean;
}) {
  const t = useT();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Arrow dir="prev" onClick={onPrev} />

      {/* Both spans share one grid cell: the hidden one sets the width from
          the longest possible label, the visible one carries the real text.
          Measuring this way is exact, unlike guessing in `ch` or px, which
          drifts with the font and with the language. */}
      <span
        style={{
          display: 'inline-grid',
          minHeight: 'var(--tap)',
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
        <span style={{ gridArea: '1 / 1' }}>{label}</span>
      </span>

      <Arrow dir="next" onClick={onNext} />

      {/* Always rendered, hidden when there is nowhere to go back to.
          Dropping it from the tree shrank the whole navigator, and since
          the navigator is centred, everything shifted — which is the very
          thing this component now promises never to do. Hidden it still
          reserves its box, and aria-hidden + disabled keep it out of the
          tab order and out of a screen reader. */}
      <button
        type="button"
        onClick={() => { if (onToday) { haptic('light'); onToday(); } }}
        aria-label={t('nav.backToCurrentMonth')}
        aria-hidden={!onToday}
        disabled={!onToday}
        tabIndex={onToday ? undefined : -1}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          minHeight: 32, marginLeft: 2, padding: '0 9px 0 7px',
          borderRadius: 999, border: '1px solid var(--q10)',
          background: 'var(--q10-soft)', color: 'var(--q10-text)',
          fontSize: 'var(--text-sm)', fontWeight: 700,
          cursor: onToday ? 'pointer' : 'default',
          whiteSpace: 'nowrap',
          visibility: onToday ? 'visible' : 'hidden',
        }}
      >
        {todayIsAhead
          ? <IconArrowForwardUp size={15} stroke={2.2} aria-hidden />
          : <IconArrowBackUp size={15} stroke={2.2} aria-hidden />}

        {/* Same stacking trick as the label, for the word itself: "Today"
            is wider than "Hoy", so without this the whole navigator —and
            with it the arrows— shifted the moment someone switched
            language. Both words are laid out hidden in the same grid cell;
            the cell takes the wider of the two, whatever the font says. */}
        <span style={{ display: 'inline-grid', alignItems: 'center', justifyItems: 'center' }}>
          {TODAY_IN_EVERY_LANGUAGE.map((word) => (
            <span key={word} aria-hidden style={{ gridArea: '1 / 1', visibility: 'hidden' }}>
              {word}
            </span>
          ))}
          <span style={{ gridArea: '1 / 1' }}>{t('nav.today')}</span>
        </span>
      </button>
    </div>
  );
}

function Arrow({ dir, onClick }: { dir: 'prev' | 'next'; onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => { haptic('light'); onClick(); }}
      aria-label={dir === 'prev' ? t('nav.prevMonth') : t('nav.nextMonth')}
      style={{
        width: 'var(--tap)', height: 'var(--tap)', display: 'grid', placeItems: 'center',
        border: 'none', background: 'none', color: 'var(--q10-text)', fontSize: 20,
        cursor: 'pointer', borderRadius: 'var(--radius-s)',
      }}
    >
      {dir === 'prev' ? '‹' : '›'}
    </button>
  );
}
