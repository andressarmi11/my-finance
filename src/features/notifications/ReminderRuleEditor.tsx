/**
 * The general reminder editor (redesign §9f "Recordatorios v2").
 *
 * Controlled and switch-less: the on/off switch for this device is
 * NotificationsSection; this only says WHEN. The segmented control picks
 * "Días antes" (stepper 1-7 + a time in half-hour steps) or "El mismo día"
 * (1 hora antes · Horas antes · Minutos antes · A una hora exacta), and a
 * notification preview under it follows every change.
 *
 * Not mounted here: Ajustes → Recordatorios mounts it and persists `value`
 * to settings.reminder (see docs/rediseno/changelog-fase-7.md).
 *
 * Switching modes keeps the other mode's fields, so going back and forth
 * never loses a choice. Same for the same-day radios: each remembers its
 * own number/time while another is selected.
 */
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { Segmented } from '@/components/ui/Segmented';
import { Logo } from '@/components/ui/Logo';
import { formatMoney } from '@/domain/money/format';
import type { ReminderRule } from '@/domain/types';
import { useLanguage } from '@/i18n/language';
import type { TextKey } from '@/i18n/texts';
import {
  DAYS_RANGE, HOURS_RANGE, MINUTES_RANGE, clamp, formatClock, reminderPreview, sameDayOption, stepTime,
  type SameDayOption,
} from './reminderRuleText';

export interface ReminderRuleEditorProps {
  value: ReminderRule;
  onChange(v: ReminderRule): void;
}

const card: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', padding: '4px 14px',
};
const row: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, borderTop: '1px solid var(--line)',
};
const stepButton: CSSProperties = {
  width: 36, height: 36, flex: 'none', borderRadius: 10, border: '1px solid var(--line-strong)',
  background: 'var(--surface-sunken)', color: 'var(--text)', fontSize: 18, fontWeight: 600, cursor: 'pointer',
};

function Stepper({ value, onLess, onMore, lessLabel, moreLabel, canLess, canMore, width = 44 }: {
  value: ReactNode; onLess: () => void; onMore: () => void; lessLabel: string; moreLabel: string;
  canLess: boolean; canMore: boolean; width?: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
      <button type="button" aria-label={lessLabel} disabled={!canLess} onClick={onLess} style={{ ...stepButton, opacity: canLess ? 1 : 0.4 }}>−</button>
      <span aria-live="polite" className="figures" style={{ minWidth: width, textAlign: 'center', fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text)' }}>
        {value}
      </span>
      <button type="button" aria-label={moreLabel} disabled={!canMore} onClick={onMore} style={{ ...stepButton, opacity: canMore ? 1 : 0.4 }}>+</button>
    </div>
  );
}

export function ReminderRuleEditor({ value, onChange }: ReminderRuleEditorProps) {
  const { t, language } = useLanguage();
  const fmt = (key: TextKey, vars: Record<string, string | number>) =>
    Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), t(key));
  const clock = (time: string) => formatClock(time, language);
  const groupName = useId();

  // The selected radio shows what `value` says (it can change from outside,
  // e.g. settings loading after mount); the others show what they held the
  // last time they were chosen, or the §9f defaults.
  const option = sameDayOption(value);
  const { kind: currentKind, value: currentValue } = value.sameDay;
  const [heldHours, setHours] = useState(2);
  const [heldMinutes, setMinutes] = useState(30);
  const [heldAt, setAtTime] = useState('08:00');
  const hours = option === 'hours' && typeof currentValue === 'number'
    ? clamp(currentValue, HOURS_RANGE.min, HOURS_RANGE.max) : heldHours;
  const minutes = currentKind === 'minutes' && typeof currentValue === 'number'
    ? clamp(currentValue, MINUTES_RANGE.min, MINUTES_RANGE.max) : heldMinutes;
  const atTime = currentKind === 'at' && typeof currentValue === 'string' ? currentValue : heldAt;

  const setSameDay = (sameDay: ReminderRule['sameDay']) => onChange({ ...value, mode: 'sameDay', sameDay });
  const choose = (o: SameDayOption) => {
    if (o === 'oneHour') setSameDay({ kind: 'hours', value: 1 });
    if (o === 'hours') setSameDay({ kind: 'hours', value: hours });
    if (o === 'minutes') setSameDay({ kind: 'minutes', value: minutes });
    if (o === 'at') setSameDay({ kind: 'at', value: atTime });
  };

  const days = Number.isFinite(value.days) ? value.days : DAYS_RANGE.min;
  const preview = reminderPreview(value);
  const concept = t('reminderRule.previewConcept');
  const headline = (() => {
    switch (preview.lead.kind) {
      case 'tomorrow': return fmt('reminderRule.dueTomorrow', { concept });
      case 'today': return fmt('reminderRule.dueToday', { concept });
      case 'inDays': return fmt('reminderRule.dueInDays', { concept, n: preview.lead.n });
      case 'inHours': return preview.lead.n === 1
        ? fmt('reminderRule.dueInOneHour', { concept })
        : fmt('reminderRule.dueInHours', { concept, n: preview.lead.n });
      case 'inMinutes': return fmt('reminderRule.dueInMinutes', { concept, n: preview.lead.n });
    }
  })();
  const previewLine = [headline, formatMoney(100_000), t('reminderRule.previewCategory'), t('reminderRule.previewMethod')].join(' · ');

  const radio = (o: SameDayOption, label: string, control?: ReactNode) => {
    const id = `${groupName}-${o}`;
    return (
      <div key={o} style={row}>
        <input
          id={id} type="radio" name={groupName} checked={value.mode === 'sameDay' && option === o}
          onChange={() => choose(o)}
          style={{ width: 20, height: 20, margin: 0, flex: 'none', accentColor: 'var(--q10)' }}
        />
        <label htmlFor={id} style={{ flex: 1, fontSize: 'var(--text-base)', color: 'var(--text)', cursor: 'pointer', padding: '14px 0' }}>
          {label}
        </label>
        {control}
      </div>
    );
  };

  return (
    <div>
      <Segmented
        label={t('reminderRule.mode')}
        options={[
          { value: 'days', label: t('reminderRule.modeDays') },
          { value: 'sameDay', label: t('reminderRule.modeSameDay') },
        ]}
        value={value.mode}
        onChange={(mode) => onChange({ ...value, mode })}
      />

      <div style={{ ...card, marginTop: 12 }}>
        {value.mode === 'days' ? (
          <>
            <div style={{ ...row, borderTop: 'none' }}>
              <span style={{ flex: 1, fontSize: 'var(--text-base)', color: 'var(--text)' }}>{t('reminderRule.daysBefore')}</span>
              <Stepper
                value={days}
                lessLabel={t('reminderRule.fewerDays')} moreLabel={t('reminderRule.moreDays')}
                canLess={days > DAYS_RANGE.min} canMore={days < DAYS_RANGE.max}
                onLess={() => onChange({ ...value, days: clamp(days - 1, DAYS_RANGE.min, DAYS_RANGE.max) })}
                onMore={() => onChange({ ...value, days: clamp(days + 1, DAYS_RANGE.min, DAYS_RANGE.max) })}
              />
            </div>
            <div style={row}>
              <span style={{ flex: 1, fontSize: 'var(--text-base)', color: 'var(--text)' }}>{t('reminderRule.time')}</span>
              <Stepper
                value={clock(value.time)} width={92}
                lessLabel={t('reminderRule.earlier')} moreLabel={t('reminderRule.later')}
                canLess={stepTime(value.time, -1) !== value.time} canMore={stepTime(value.time, 1) !== value.time}
                onLess={() => onChange({ ...value, time: stepTime(value.time, -1) })}
                onMore={() => onChange({ ...value, time: stepTime(value.time, 1) })}
              />
            </div>
          </>
        ) : (
          <div role="radiogroup" aria-label={t('reminderRule.sameDayOptions')}>
            <div style={{ ...row, borderTop: 'none', minHeight: 0, padding: '10px 0 8px' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{t('reminderRule.sameDayHint')}</span>
            </div>
            {radio('oneHour', t('reminderRule.oneHour'))}
            {radio('hours', t('reminderRule.hoursBefore'), (
              <Stepper
                value={hours}
                lessLabel={t('reminderRule.fewerHours')} moreLabel={t('reminderRule.moreHours')}
                canLess={hours > HOURS_RANGE.min} canMore={hours < HOURS_RANGE.max}
                onLess={() => { const n = clamp(hours - 1, HOURS_RANGE.min, HOURS_RANGE.max); setHours(n); setSameDay({ kind: 'hours', value: n }); }}
                onMore={() => { const n = clamp(hours + 1, HOURS_RANGE.min, HOURS_RANGE.max); setHours(n); setSameDay({ kind: 'hours', value: n }); }}
              />
            ))}
            {radio('minutes', t('reminderRule.minutesBefore'), (
              <Stepper
                value={minutes}
                lessLabel={t('reminderRule.fewerMinutes')} moreLabel={t('reminderRule.moreMinutes')}
                canLess={minutes > MINUTES_RANGE.min} canMore={minutes < MINUTES_RANGE.max}
                onLess={() => { const n = clamp(minutes - MINUTES_RANGE.step, MINUTES_RANGE.min, MINUTES_RANGE.max); setMinutes(n); setSameDay({ kind: 'minutes', value: n }); }}
                onMore={() => { const n = clamp(minutes + MINUTES_RANGE.step, MINUTES_RANGE.min, MINUTES_RANGE.max); setMinutes(n); setSameDay({ kind: 'minutes', value: n }); }}
              />
            ))}
            {radio('at', t('reminderRule.atTime'), (
              <Stepper
                value={clock(atTime)} width={92}
                lessLabel={t('reminderRule.earlier')} moreLabel={t('reminderRule.later')}
                canLess={stepTime(atTime, -1) !== atTime} canMore={stepTime(atTime, 1) !== atTime}
                onLess={() => { const v = stepTime(atTime, -1); setAtTime(v); setSameDay({ kind: 'at', value: v }); }}
                onMore={() => { const v = stepTime(atTime, 1); setAtTime(v); setSameDay({ kind: 'at', value: v }); }}
              />
            ))}
          </div>
        )}
      </div>

      <p style={{ margin: '18px 0 8px', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-muted)' }}>
        {t('reminderRule.preview')}
      </p>
      <div
        role="img"
        aria-label={`${t('reminderRule.preview')}: ${previewLine}. ${fmt('reminderRule.arrivesAt', { time: clock(preview.at) })}`}
        style={{ ...card, display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, background: 'var(--surface-sunken)' }}
      >
        <Logo size={36} tile />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 'var(--text-sm)' }}>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>Step up</span>
            <span className="figures" style={{ color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{clock(preview.at)}</span>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: 'var(--text-base)', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
            {previewLine}
          </p>
        </div>
      </div>
    </div>
  );
}
