import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { monthName } from '@/components/ui/MonthNav';
import { localRepository } from '@/data/local/localRepository';
import { useT } from '@/i18n/language';
import { monthFromLabel, payPeriodLabel } from '@/i18n/periodLabels';
import { fill } from '@/lib/dateLabels';
import { todayISO } from '@/lib/todayISO';
import { ControlRow, SettingsGroup, Stepper, card, noteStyle, useSettingsBack } from './ui';
import { payPreview } from './payPreview';

/** Two pay days need at least a day between them: pago1 + 2 ≤ pago2. */
const MIN_GAP = 2;

/**
 * Cómo te pagan (redesign §9d): once or twice a month and on which days.
 * Everything else — periods, groups, "te queda" — hangs from this, so a
 * 30-day preview shows how this month splits before leaving the screen.
 */
export function PayDaysScreen() {
  const t = useT();
  const back = useSettingsBack();
  const settings = useLiveQuery(() => localRepository.getSettings(), []);
  if (!settings) return null;

  const twice = settings.payDays.length > 1;
  const pay1 = settings.payDays[0] ?? (twice ? 10 : 1);
  const pay2 = settings.payDays[1] ?? 25;
  const save = (payDays: number[]) => void localRepository.saveSettings({ ...settings, payDays });

  const [year, month] = todayISO().split('-').map(Number) as [number, number];
  const preview = payPreview(year, month, settings.payDays);
  const colorOf = (index: number) => (twice && index === 2 ? 'var(--q25)' : 'var(--q10)');
  const monthLabel = monthName(month);

  function periodLabel(startDay: number): string {
    if (twice) return `${payPeriodLabel()} ${startDay}`;
    return startDay === 1 ? monthLabel : `${monthFromLabel()} ${startDay}`;
  }

  return (
    <Screen title={t('settings.howYouGetPaid')} subtitle={t('set.payIntro')} back={back}>
      <Segmented
        label={t('settings.moneyComesIn')}
        value={twice ? 'two' : 'one'}
        onChange={(v) => {
          if ((v === 'two') === twice) return;
          // Monthly starts on day 1, the calendar month: inheriting the
          // first pay day would shift the month without being asked to.
          save(v === 'two' ? [10, 25] : [1]);
        }}
        options={[
          { value: 'two', label: t('settings.twiceAMonth') },
          { value: 'one', label: t('settings.onceAMonth') },
        ]}
      />

      <SettingsGroup style={{ marginTop: 14 }}>
        {twice ? (
          <ControlRow label={t('set.firstPay')} dot="var(--q10)">
            <Stepper label={t('set.firstPay')} value={pay1} min={1} max={pay2 - MIN_GAP} onChange={(v) => save([v, pay2])} />
          </ControlRow>
        ) : (
          <ControlRow label={t('settings.monthStartsOn')} dot="var(--q10)">
            <Stepper label={t('settings.monthStartsOn')} value={pay1} min={1} max={31} onChange={(v) => save([v])} />
          </ControlRow>
        )}
        {twice && (
          <ControlRow label={t('set.secondPay')} dot="var(--q25)">
            <Stepper label={t('set.secondPay')} value={pay2} min={pay1 + MIN_GAP} max={31} onChange={(v) => save([pay1, v])} />
          </ControlRow>
        )}
      </SettingsGroup>

      <div style={{ margin: '24px 6px 10px' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-faint)' }}>
          {fill(t('set.previewOf'), { month: monthLabel })}
        </h2>
      </div>
      <div style={{ ...card, padding: 16 }}>
        <div aria-hidden style={{ display: 'flex', gap: 2, height: 28 }}>
          {preview.days.map((d, i) => (
            <span
              key={i}
              title={String(d.day)}
              style={{
                flex: 1, borderRadius: 3, background: colorOf(d.index),
                opacity: !twice && d.fromPrevMonth ? 0.4 : 1,
              }}
            />
          ))}
        </div>
        <div aria-hidden style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
          <span>1</span><span>15</span><span>30</span>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {preview.periods.map((p) => (
            <li key={p.index} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: colorOf(p.index), flex: 'none' }} />
              <span style={{ flex: 1, fontWeight: 600, fontSize: 'var(--text-md)' }}>{periodLabel(p.startDay)}</span>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textAlign: 'right' }}>
                {fill(t(p.endsNextMonth ? 'set.rangeNextMonth' : 'set.rangeSameMonth'), { from: p.startDay, to: p.endDay })}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p style={{ ...noteStyle, fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>{t('set.payCrossNote')}</p>
    </Screen>
  );
}
