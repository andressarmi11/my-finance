import { IconBell, IconBellOff } from '@tabler/icons-react';
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
export function ReminderChips({ value, onChange }: { value: TxReminder; onChange: (v: TxReminder) => void }) {
  const t = useT();
  return (
    <div role="group" aria-label={t('reminder.label')} style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginBottom: 12 }}>
      {PRESETS.map((p) => {
        const active = same(value, p.value);
        return (
          <button
            key={p.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(p.value)}
            style={{
              flex: 'none', display: 'flex', alignItems: 'center', gap: 5,
              minHeight: 32, padding: '0 11px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
              border: `1px solid ${active ? 'var(--q10)' : 'var(--line-strong)'}`,
              background: active ? 'var(--q10-soft)' : 'transparent',
              color: active ? 'var(--q10-text)' : 'var(--text-muted)',
              fontSize: 'var(--text-sm)', fontWeight: 600,
            }}
          >
            {p.value === 'none'
              ? <IconBellOff size={14} stroke={2} aria-hidden />
              : <IconBell size={14} stroke={2} aria-hidden />}
            {t(p.key)}
          </button>
        );
      })}
    </div>
  );
}
