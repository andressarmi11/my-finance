import { useState } from 'react';
import { addDays, parseISO, toISO } from '@/domain/dates';
import { buildCalendarGrid, shiftMonthISO } from '@/features/calendar/calendarGrid';
import { monthName } from '@/components/ui/MonthNav';
import { useT } from '@/i18n/language';
import { dateLabel } from '@/lib/dateLabels';

/** 'Hoy' / 'Ayer' / 'Mañana' / '3 oct' — what the date chip says. */
export function relativeDayLabel(iso: string, today: string, t: ReturnType<typeof useT>): string {
  const base = parseISO(today);
  if (iso === today) return t('date.today');
  if (iso === toISO(addDays(base, -1))) return t('date.yesterday');
  if (iso === toISO(addDays(base, 1))) return t('date.tomorrow');
  return dateLabel(iso, t, 'short');
}

/**
 * A month grid inside the sheet (redesign §9b), instead of the system date
 * picker: month navigation, today with a ring, the chosen day filled in
 * `--q10`, and Ayer · Hoy · Mañana shortcuts underneath.
 */
export function MiniCalendar({ value, today, onChange }: {
  value: string;
  today: string;
  onChange: (iso: string) => void;
}) {
  const t = useT();
  const weekdays = t('calendar.weekdays').split(',');
  const start = parseISO(value || today);
  const [view, setView] = useState({ year: start.y, month: start.m });
  const cells = buildCalendarGrid(view.year, view.month);
  const base = parseISO(today);
  const shortcuts = [
    { iso: toISO(addDays(base, -1)), label: t('date.yesterday') },
    { iso: today, label: t('date.today') },
    { iso: toISO(addDays(base, 1)), label: t('date.tomorrow') },
  ];

  const pick = (iso: string) => {
    const d = parseISO(iso);
    setView({ year: d.y, month: d.m });
    onChange(iso);
  };

  return (
    <div
      style={{
        background: 'var(--paper)', borderRadius: 16,
        padding: 10, marginBottom: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px 6px' }}>
        <button type="button" aria-label={t('nav.prevMonth')} onClick={() => setView((v) => shiftMonthISO(v.year, v.month, -1))} style={arrowStyle}>‹</button>
        <span aria-live="polite" style={{ fontSize: 14, fontWeight: 700 }}>
          {monthName(view.month)} {view.year}
        </span>
        <button type="button" aria-label={t('nav.nextMonth')} onClick={() => setView((v) => shiftMonthISO(v.year, v.month, 1))} style={arrowStyle}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', paddingBottom: 2 }}>
        {weekdays.map((w, i) => (
          <span key={i} aria-hidden style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)' }}>{w}</span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((cell) => {
          const selected = cell.date === value;
          const isToday = cell.date === today;
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => pick(cell.date)}
              aria-pressed={selected}
              aria-label={dateLabel(cell.date, t, 'long')}
              // Only this month's days (prototype): the others keep their
              // cell, so the weeks stay aligned, but aren't shown.
              aria-hidden={!cell.inMonth || undefined}
              tabIndex={cell.inMonth ? undefined : -1}
              style={{
                height: 36, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
                display: 'grid', placeItems: 'center', visibility: cell.inMonth ? 'visible' : 'hidden',
              }}
            >
              <span
                style={{
                  width: 32, height: 32, borderRadius: 16, display: 'grid', placeItems: 'center',
                  background: selected ? 'var(--q10)' : 'transparent',
                  boxShadow: isToday && !selected ? 'inset 0 0 0 1.5px var(--q10)' : 'none',
                  // Past days a step quieter than the ones ahead.
                  color: selected ? 'var(--on-accent)' : isToday ? 'var(--q10-text)' : cell.date > today ? 'var(--text)' : 'var(--text-muted)',
                  fontSize: 14, fontWeight: selected || isToday ? 700 : 500,
                }}
              >
                {Number(cell.date.slice(8, 10))}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
        {shortcuts.map((s) => (
          <button
            key={s.iso}
            type="button"
            onClick={() => pick(s.iso)}
            aria-pressed={value === s.iso}
            style={{
              height: 30, padding: '0 12px', borderRadius: 15, cursor: 'pointer', border: 'none',
              background: value === s.iso ? 'var(--q10-soft)' : 'var(--surface-sunken)',
              color: value === s.iso ? 'var(--q10-text)' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const arrowStyle: React.CSSProperties = {
  width: 32, height: 32, border: 'none', borderRadius: 10, background: 'var(--surface-sunken)', cursor: 'pointer',
  color: 'var(--text-muted)', fontSize: 18,
};
