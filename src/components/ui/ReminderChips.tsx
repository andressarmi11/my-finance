import { IconBell } from '@tabler/icons-react';
import type { ReminderRule, Transaction } from '@/domain/types';
import { useT } from '@/i18n/language';
import type { TextKey } from '@/i18n/texts';

type TxReminder = Transaction['reminder'];

/** The per-transaction presets (redesign §9f "Por movimiento"). null = the general one. */
const PRESETS: Array<{ key: TextKey; value: TxReminder }> = [
  { key: 'reminder.general', value: null },
  { key: 'reminder.none', value: 'none' },
  { key: 'reminder.dayBefore', value: { mode: 'days', days: 1, time: '09:00', sameDay: { kind: 'hours', value: 1 } } },
  { key: 'reminder.hourBefore', value: { mode: 'sameDay', days: 1, time: '09:00', sameDay: { kind: 'hours', value: 1 } } },
  { key: 'reminder.sameDayAt8', value: { mode: 'sameDay', days: 1, time: '09:00', sameDay: { kind: 'at', value: '08:00' } } },
];

function same(a: TxReminder, b: TxReminder): boolean {
  if (a == null || b == null) return a == null && b == null;
  if (a === 'none' || b === 'none') return a === b;
  const x = a as ReminderRule;
  const y = b as ReminderRule;
  if (x.mode !== y.mode) return false;
  return x.mode === 'days'
    ? x.days === y.days && x.time === y.time
    : x.sameDay.kind === y.sameDay.kind && x.sameDay.value === y.sameDay.value;
}

/**
 * Bell chips to override the general reminder for one transaction. Only the
 * presets: the full editor lives in Ajustes → Recordatorios.
 */
export function ReminderChips({ value, onChange, wrap = false }: {
  value: TxReminder; onChange: (v: TxReminder) => void;
  /** Desktop form (prototype 2a): the chips wrap under an "Aviso" label, no bell. */
  wrap?: boolean;
}) {
  const t = useT();
  return (
    // Prototype 1a: one bell in front of the row, plain chips after it.
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
    {!wrap && <IconBell size={17} stroke={1.9} aria-hidden style={{ flex: 'none', color: 'var(--text-faint)' }} />}
    <div role="group" aria-label={t('reminder.label')} className="noscroll" style={{ display: 'flex', gap: 6, overflowX: wrap ? 'visible' : 'auto', flexWrap: wrap ? 'wrap' : 'nowrap', scrollbarWidth: 'none', minWidth: 0 }}>
      {PRESETS.map((p) => {
        const active = same(value, p.value);
        return (
          <button
            key={p.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(p.value)}
            style={{
              flex: 'none', display: 'flex', alignItems: 'center',
              height: 30, padding: '0 11px', borderRadius: 15, cursor: 'pointer', whiteSpace: 'nowrap',
              border: `1px solid ${active ? 'var(--q10)' : 'var(--line)'}`,
              background: active ? 'var(--q10-soft)' : 'var(--paper)',
              color: active ? 'var(--text)' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600,
            }}
          >
            {t(p.key)}
          </button>
        );
      })}
    </div>
    </div>
  );
}
