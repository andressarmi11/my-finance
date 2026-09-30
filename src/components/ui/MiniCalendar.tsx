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
        background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 16,
        padding: '8px 10px 10px', marginBottom: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <button type="button" aria-label={t('nav.prevMonth')} onClick={() => setView((v) => shiftMonthISO(v.year, v.month, -1))} style={arrowStyle}>‹</button>
        <span aria-live="polite" style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>
          {monthName(view.month)} {view.year}
        </span>
        <button type="button" aria-label={t('nav.nextMonth')} onClick={() => setView((v) => shiftMonthISO(v.year, v.month, 1))} style={arrowStyle}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
        {weekdays.map((w, i) => (
          <span key={i} aria-hidden style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-faint)' }}>{w}</span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 2 }}>
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
              style={{
                height: 36, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
                display: 'grid', placeItems: 'center', opacity: cell.inMonth ? 1 : 0.35,
              }}
            >
              <span
                style={{
                  width: 32, height: 32, borderRadius: 16, display: 'grid', placeItems: 'center',
                  background: selected ? 'var(--q10)' : 'transparent',
                  boxShadow: isToday && !selected ? 'inset 0 0 0 1.5px var(--q10)' : 'none',
                  color: selected ? 'var(--on-accent)' : 'var(--text)',
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
              minHeight: 32, padding: '0 12px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${value === s.iso ? 'var(--q10)' : 'var(--line-strong)'}`,
              background: value === s.iso ? 'var(--q10-soft)' : 'transparent',
              color: value === s.iso ? 'var(--q10-text)' : 'var(--text)',
              fontSize: 'var(--text-sm)', fontWeight: 600,
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
  width: 'var(--tap)', height: 36, border: 'none', background: 'none', cursor: 'pointer',
  color: 'var(--q10-text)', fontSize: 20,
};
